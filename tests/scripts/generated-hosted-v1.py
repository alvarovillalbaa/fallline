"""H01 remote tools and public client only, within the approved two-minute job."""
from pathlib import Path
import hashlib, json, os, secrets, shutil, signal, subprocess, time
repo = Path.cwd().resolve()
runner = Path(os.environ['RUNNER_TEMP']).resolve()
job = os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT']
out = Path(os.environ['FALLLINE_OUTPUT']).resolve()
owned = Path('/tmp') / ('fl-hosted-' + job)
assert out.parent == runner and out.name == 'fallline-hosted-proof-' + job
assert not out.exists() and not owned.exists()
out.mkdir()
owned.mkdir(mode=0o700)
owner = {'job': job, 'nonce': secrets.token_hex(16)}
(owned / 'owner.json').write_text(json.dumps(owner))
inode = owned.stat().st_ino
receipt = {'passed': False, 'source': os.environ['GITHUB_SHA'], 'commands': [], 'cleanup': False}
sha = lambda value: hashlib.sha256(value).hexdigest()
def vector():
    names = [os.fsdecode(name) for name in subprocess.check_output(['git', 'ls-files', '-z'], cwd=repo).split(b'\0') if name]
    return [{'path': name, 'bytes': (repo / name).stat().st_size, 'sha256': sha((repo / name).read_bytes())} for name in names]
before = vector()
(out / 'source-before.json').write_text(json.dumps(before, indent=2))
deadline = time.monotonic() + 90
for name in ['tmp', 'tools', 'browsers', 'npm-cache']:
    (owned / name).mkdir()
env = {key: os.environ[key] for key in ['PATH', 'HOME', 'GITHUB_SHA', 'FALLLINE_RELEASE_SOURCE', 'FALLLINE_READY_DEPLOYMENT']}
env.update(TMPDIR=str(owned / 'tmp'), npm_config_cache=str(owned / 'npm-cache'), npm_config_audit='false', npm_config_fund='false', npm_config_update_notifier='false', PLAYWRIGHT_BROWSERS_PATH=str(owned / 'browsers'), FALLLINE_OUTPUT=str(out), FALLLINE_PLAYWRIGHT=str(owned / 'tools/node_modules/playwright/index.mjs'))
def absent(pid):
    try:
        os.killpg(pid, 0)
        return False
    except ProcessLookupError:
        return True
def run(label, argv, limit, cwd=repo):
    maximum = min(limit, deadline - time.monotonic() - 10)
    if maximum < 1:
        raise RuntimeError('H01 deadline before ' + label)
    start = time.monotonic()
    child = subprocess.Popen(argv, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    timed_out = False
    try:
        stdout, stderr = child.communicate(timeout=maximum)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGTERM)
        try:
            stdout, stderr = child.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            stdout, stderr = child.communicate(timeout=3)
    group_absent = absent(child.pid)
    if not group_absent:
        os.killpg(child.pid, signal.SIGTERM)
        time.sleep(.2)
        if not absent(child.pid):
            os.killpg(child.pid, signal.SIGKILL)
    (out / (label + '.stdout.txt')).write_bytes(stdout)
    (out / (label + '.stderr.txt')).write_bytes(stderr)
    row = {'label': label, 'exit': child.returncode, 'timedOut': timed_out, 'groupAbsent': group_absent, 'seconds': time.monotonic() - start, 'stdoutSha256': sha(stdout), 'stderrSha256': sha(stderr)}
    receipt['commands'].append(row)
    print(json.dumps(row), flush=True)
    if child.returncode or timed_out or not group_absent:
        raise RuntimeError(label + ' failed normal closure')
try:
    receipt['diskFreeBytesBefore'] = shutil.disk_usage(owned).free
    assert receipt['diskFreeBytesBefore'] >= 34 * 1024**3, 'Runner Storage Guard refused installation'
    run('node-version', ['node', '--version'], 5)
    assert (out / 'node-version.stdout.txt').read_text().strip() == 'v24.22.2'
    for item in json.loads((repo / 'docs/qualification/generated-v5-public-manifest.json').read_text()):
        value = (repo / 'public' / item['path']).read_bytes()
        assert len(value) == item['bytes'] and sha(value) == item['sha256']
    tools = owned / 'tools'
    (tools / 'package.json').write_text('{"private":true,"dependencies":{"playwright":"1.64.1"}}')
    run('browser-tools', ['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', '--registry=https://registry.npmjs.org/'], 55, tools)
    for name in ['playwright', 'playwright-core']:
        assert json.loads((tools / 'node_modules' / name / 'package.json').read_text())['version'] == '1.64.1'
    shutil.copyfile(tools / 'package-lock.json', out / 'tools-lock.json')
    run('chromium', ['node', str(tools / 'node_modules/playwright/cli.js'), 'install', '--no-shell', 'chromium'], 55)
    run('hosted-browser', ['node', 'tests/browser/generated-hosted-v1.mjs'], 65)
    native = json.loads((out / 'hosted-browser.json').read_text())
    assert native['passed'] and len(native['resources']) == 16
    assert native['cleanup']['native']['exitCode'] == 0 and native['cleanup']['native']['absent']
    receipt['passed'] = True
except Exception as error:
    receipt['error'] = type(error).__name__ + ': ' + str(error)
finally:
    after = vector()
    (out / 'source-after.json').write_text(json.dumps(after, indent=2))
    receipt['sourceStable'] = before == after
    receipt['gitClean'] = not subprocess.check_output(['git', 'status', '--porcelain'], cwd=repo).strip()
    lingering = []
    for item in Path('/proc').iterdir():
        if not item.name.isdigit():
            continue
        try:
            if item.stat().st_uid == os.getuid() and (item / 'exe').resolve().is_relative_to(owned):
                lingering.append(int(item.name))
        except (OSError, RuntimeError):
            pass
    receipt['lingeringOwnedPids'] = lingering
    for pid in lingering:
        try:
            candidate = Path('/proc') / str(pid)
            if candidate.stat().st_uid == os.getuid() and (candidate / 'exe').resolve(strict=True).is_relative_to(owned):
                os.kill(pid, signal.SIGTERM)
        except (OSError, RuntimeError):
            pass
    if lingering:
        time.sleep(.5)
    remaining = []
    for pid in lingering:
        try:
            executable = (Path('/proc') / str(pid) / 'exe').resolve(strict=True)
            if executable.is_relative_to(owned):
                os.kill(pid, signal.SIGKILL)
                remaining.append(pid)
        except (OSError, RuntimeError):
            pass
    if remaining:
        time.sleep(.2)
    receipt['ownedProcessesAbsent'] = all(not (Path('/proc') / str(pid) / 'exe').exists() for pid in lingering)
    if receipt['ownedProcessesAbsent'] and owned.stat().st_ino == inode and json.loads((owned / 'owner.json').read_text()) == owner:
        shutil.rmtree(owned)
        receipt['cleanup'] = not owned.exists()
    receipt['passed'] = bool(receipt['passed'] and receipt['sourceStable'] and receipt['gitClean'] and receipt['cleanup'] and not lingering)
    (out / 'runner.json').write_text(json.dumps(receipt, indent=2))
    print('FALLLINE_HOSTED_RECEIPT ' + json.dumps(receipt), flush=True)
if not receipt['passed']:
    raise SystemExit(1)
