"""Retire only the leased generated-edition QA ref after actual H01 success."""
import json, os, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path
repository = 'alvarovillalbaa/fallline'
branch = 'qa/fallline-generated-20261115'
workflow = '.github/workflows/generated-v1-qa.yml'
main_sha = os.environ['FALLLINE_RELEASE_SOURCE']
expected_qa = os.environ['GITHUB_SHA']
token = os.environ['FALLLINE_RETIRE_TOKEN']
out = Path(os.environ['FALLLINE_RETIRE_OUTPUT']).resolve()
runner = Path(os.environ['RUNNER_TEMP']).resolve()
job = os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT']
assert out.parent == runner and out.name == 'fallline-generated-retirement-' + job
out.mkdir()
receipt = {'passed': False, 'main': main_sha, 'qaBefore': expected_qa, 'requests': []}
deadline = time.monotonic() + 35
def request(method, path, body=None):
    remaining = deadline - time.monotonic()
    if remaining <= 1:
        raise RuntimeError('Retirement deadline')
    req = urllib.request.Request('https://api.github.com/repos/' + repository + path,
        data=json.dumps(body).encode() if body is not None else None, method=method,
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'fallline-owned-retirement'})
    try:
        with urllib.request.urlopen(req, timeout=min(5, remaining - .5)) as response:
            data = response.read(2 * 1024**2)
            receipt['requests'].append({'method': method, 'path': path, 'status': response.status})
            return response.status, json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        receipt['requests'].append({'method': method, 'path': path, 'status': error.code})
        if error.code == 404:
            return 404, None
        raise RuntimeError('Retirement HTTP' + str(error.code)) from None
try:
    if os.environ.get('GITHUB_REPOSITORY') != repository or os.environ.get('GITHUB_REF_NAME') != branch:
        raise RuntimeError('Wrong task owner/ref')
    root = Path('docs/results/2026/11-15/generated-v5/hosted')
    original = json.loads((root / 'runner.json').read_text())
    browser = json.loads((root / 'hosted-browser.json').read_text())
    if not original['passed'] or not browser['passed'] or browser['releaseSource'] != main_sha or len(browser['resources']) != 16:
        raise RuntimeError('Actual public H01 not accepted')
    if browser['cleanup']['native']['exitCode'] != 0 or not browser['cleanup']['native']['absent']:
        raise RuntimeError('H01 normal browser closure missing')
    code, main = request('GET', '/git/ref/heads/main')
    if code != 200 or main['object']['sha'] != main_sha:
        raise RuntimeError('Main lease changed')
    code, qa = request('GET', '/git/ref/heads/' + branch)
    if code != 200 or qa['object']['sha'] != expected_qa:
        raise RuntimeError('QA lease changed')
    code, ignored = request('GET', '/contents/' + workflow + '?ref=main')
    if code != 404:
        raise RuntimeError('Temporary recipe unexpectedly on main')
    code, file = request('GET', '/contents/' + workflow + '?ref=' + urllib.parse.quote(branch, safe=''))
    if code != 200:
        raise RuntimeError('Owned workflow missing')
    code, deleted = request('DELETE', '/contents/' + workflow, {'branch': branch, 'sha': file['sha'], 'message': 'chore: retire accepted generated-edition temporary workflow'})
    if code != 200:
        raise RuntimeError('Workflow deletion not acknowledged')
    retired = deleted['commit']['sha']
    receipt['retiredCommit'] = retired
    code, ignored = request('GET', '/contents/' + workflow + '?ref=' + urllib.parse.quote(branch, safe=''))
    if code != 404:
        raise RuntimeError('Workflow remains reachable')
    code, qa = request('GET', '/git/ref/heads/' + branch)
    if code != 200 or qa['object']['sha'] != retired:
        raise RuntimeError('QA changed immediately before deletion')
    code, ignored = request('DELETE', '/git/refs/heads/' + branch)
    if code != 204:
        raise RuntimeError('Ref deletion not acknowledged')
    code, ignored = request('GET', '/git/ref/heads/' + branch)
    if code != 404:
        raise RuntimeError('Owned ref remains reachable')
    code, main = request('GET', '/git/ref/heads/main')
    if code != 200 or main['object']['sha'] != main_sha:
        raise RuntimeError('Main changed during retirement')
    receipt.update(passed=True, workflowAbsent=True, qaDeleted=True, mainUnchanged=True,
        deleteSemantics='serialized exact owner reads; GitHub DELETE ref is not atomic CAS')
except Exception as error:
    receipt['error'] = str(error)
finally:
    (out / 'receipt.json').write_text(json.dumps(receipt, indent=2))
    print('FALLLINE_GENERATED_RETIREMENT ' + json.dumps(receipt), flush=True)
if not receipt['passed']:
    raise SystemExit(1)
