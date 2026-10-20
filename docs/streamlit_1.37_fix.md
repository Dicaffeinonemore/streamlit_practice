# v1.37 Streamlit 실행 오류 대응

2026-10-21. 배포 화면은 `Oh no. Error running app`, 제공된 최신 로그는 `healthz: EOF`였다. 이전 `asset-loader.js` 오류 뒤 여러 차례 업데이트가 기록되어 있어 현재 종료 원인을 그 파일 누락으로 확정하지 않았다. 배포 서버 메모리 측정이나 최신 Python traceback은 확보하지 못했다.

로컬에서 기존 `build_single_html()` 결과는 **176,625,624 bytes**였다. 이를 Streamlit iframe HTML로 직렬화하는 과정의 큰 메모리 부담을 제거했다. 단순 gzip+base64는173,238,068 bytes로 효과가 작아 채택하지 않았다.

`run_streamlit()`은 이제 `components.declare_component()`로 필요한 공개 게임 파일만 제공한다. 임시 폴더로 복사할 때1MB씩 읽고, 변경 없는 파일은 그대로 사용한다. HTML과 JavaScript 순서는 기존과 같으며 BGM도 같은 서버에서 받는다. 검수 화면도 JSON·이미지를 통째로 인라인하지 않는다. 원본 게임 파일·아트·전투 로직은 수정하지 않았다.

`streamlit-bridge.js`는 준비 메시지와 iframe 높이 설정만 처리한다. `requirements.txt`는 실제 시험한 Streamlit1.56.0을 고정한다. 기존 단일 HTML 함수는 도구 호환용으로 남아 있지만 Streamlit 실행 경로에서는 사용하지 않는다.

검증:

- Python5개 검사 통과: 실제 게임/검수 전환, 별도 파일 제공·복사 재사용·공개 대상 제한, 과거 목록 무시, 누락 안내, 다른 실행 디렉터리.
- 게임 컴포넌트 메시지117 bytes, 진입 HTML33,422 bytes. 큰 JavaScript는 HTTP로 별도 제공되므로 이 수치가 전체 다운로드 용량을 뜻하지는 않는다.
- 실제 Streamlit 서버+격리 Chrome에서 타이틀·논리 해상도960×540 확인. 브라우저 예외/console error0, 초기화 뒤 health 정상.
- [실행 결과](../artifacts/streamlit-1.37/smoke.json), [실행 화면](../artifacts/streamlit-1.37/game.png).
- 클라우드 재배포는 아직 수행하지 않았다. 메모리 부족이 실제 장애 원인이었다고 확정한 검증도 아니다.

재현:

```powershell
python -m pip install -r requirements.txt
$env:PYTHONDONTWRITEBYTECODE='1'
python -m unittest discover -s tests -p test_server_bundle.py -v
$env:STREAMLIT_TEST_PYTHON=(Get-Command python).Source
node tests/streamlit-smoke.cjs
```

배포는 이 수정 파일들을 같은 커밋으로 푸시한 뒤 확인한다. 앱이 오류 상태에 머물면 관리 화면에서 재부팅하고 새 로그를 확인한다. 기준은 [Streamlit 공식 관리 안내](https://docs.streamlit.io/deploy/streamlit-community-cloud/manage-your-app)와 [재부팅 안내](https://docs.streamlit.io/deploy/streamlit-community-cloud/manage-your-app/reboot-your-app)다. 새 화면 아래 `v1.37 · 파일별 로딩` 표시로 변경 경로 적용 여부를 구분할 수 있다.
