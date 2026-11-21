class_name BmkDemoSteps
extends RefCounted
## demo-runtime.js DEMO_STEPS, generated from the source by tools/oracle/phase12_steps.cjs
## (phase12/fixtures/traces.json). script: [kind, action, start ms, press ms]; setup: {sp} or {mg}.
const MAX_MS: float = 10000.0
const STEPS: Dictionary = {
	"barel": [
		{"title":"이동","keys":["KeyA","KeyD","KeyW","KeyS"],"dummy":430,"desc":"좌우로 걷고 위/아래로 줄(깊이)을 바꿉니다. 적과 같은 줄에 서야 공격이 맞습니다. 화면에 GO → 가 뜨면 오른쪽으로 전진하세요.","script":[["hold","KeyD",0,700],["hold","KeyW",820,380],["hold","KeyS",1300,380],["hold","KeyA",1800,500]],"setup":null},
		{"title":"점프","keys":["Space"],"dummy":430,"desc":"점프로 바닥 충격파와 낮은 공격을 넘습니다. 이동 키를 누른 채 점프하면 앞으로 뛰어오릅니다.","script":[["tap","Space",200],["hold","KeyD",1350,750],["tap","Space",1420]],"setup":null},
		{"title":"공격 3연타","keys":["KeyJ"],"dummy":78,"desc":"연타하면 3연 콤보! 3타 참격은 검기를 날립니다. 연속으로 맞히면 HIT가 쌓이고 보스에게 주는 피해가 커집니다.","script":[["tap","KeyJ",200],["tap","KeyJ",430],["tap","KeyJ",660]],"setup":null},
		{"title":"대시 · 대시 찌르기","keys":["ShiftLeft","KeyJ"],"dummy":360,"desc":"잠깐 무적이 되는 빠른 이동입니다. 같은 방향 이동 키를 빠르게 두 번 눌러도 됩니다. 대시 중 공격하면 대시 찌르기.","script":[["tap","ShiftLeft",200],["tap","ShiftLeft",1250],["tap","KeyJ",1360]],"setup":null},
		{"title":"공중 공격","keys":["Space","KeyJ"],"dummy":85,"desc":"점프 중에 공격하면 공중 베기가 나갑니다.","script":[["tap","Space",200],["tap","KeyJ",470]],"setup":null},
		{"title":"견제 찌르기","keys":["KeyU"],"dummy":110,"desc":"앞으로 빠르게 찌르는 견제 기술. 기술은 각자 재사용 시간이 있습니다.","script":[["tap","KeyU",250]],"setup":null},
		{"title":"내려찍기","keys":["KeyH"],"dummy":90,"desc":"검을 땅에 내려찍어 주변 적을 넘어뜨립니다.","script":[["tap","KeyH",250]],"setup":null},
		{"title":"회전 베기","keys":["KeyO"],"dummy":80,"desc":"몸을 돌려 앞뒤의 적을 한꺼번에 벱니다. 둘러싸였을 때 유용합니다.","script":[["tap","KeyO",250]],"setup":null},
		{"title":"점프 강하","keys":["KeyP"],"dummy":170,"desc":"높이 뛰어올라 앞쪽 적에게 내리꽂힙니다.","script":[["tap","KeyP",250]],"setup":null},
		{"title":"붉은 파동","keys":["KeyL"],"dummy":300,"desc":"멀리 날아가며 적을 꿰뚫는 붉은 검기 (재사용 6.5초).","script":[["tap","KeyL",250]],"setup":null},
		{"title":"필살기 흑월참","keys":["KeyK"],"dummy":160,"desc":"SP 게이지가 가득 차면 사용! 돌진 3연 베기 + 초승달 마무리. 사용하는 동안 무적입니다.","script":[["tap","KeyK",350]],"setup":{"sp":100}},
		{"title":"마법 뇌격","keys":["KeyI"],"dummy":260,"desc":"두루마리 1개로 화면 안의 모든 적에게 번개! 두루마리는 최대 3개까지 모입니다.","script":[["tap","KeyI",350]],"setup":{"mg":1}},
	],
	"viesa": [
		{"title":"이동","keys":["KeyA","KeyD","KeyW","KeyS"],"dummy":430,"desc":"좌우로 걷고 위/아래로 사격 줄(깊이)을 바꿉니다. 화살은 같은 줄의 적에게 맞습니다.","script":[["hold","KeyD",0,700],["hold","KeyW",820,380],["hold","KeyS",1300,380],["hold","KeyA",1800,500]],"setup":null},
		{"title":"점프","keys":["Space"],"dummy":430,"desc":"점프로 바닥 충격파와 낮은 공격을 넘습니다. 이동 키를 누른 채 점프하면 앞으로 뛰어오릅니다.","script":[["tap","Space",200],["hold","KeyD",1350,750],["tap","Space",1420]],"setup":null},
		{"title":"화살","keys":["KeyJ"],"dummy":320,"desc":"화살 한 발에 8 피해. 사격 도중 다시 누르면 연속 사격합니다. 화살은 무제한입니다.","script":[["tap","KeyJ",200],["tap","KeyJ",560],["tap","KeyJ",920]],"setup":null},
		{"title":"대시","keys":["ShiftLeft"],"dummy":400,"desc":"이동하는 동안 무적인 빠른 이동입니다. 같은 방향 이동 키를 빠르게 두 번 눌러도 됩니다.","script":[["tap","ShiftLeft",200],["tap","ShiftLeft",1200]],"setup":null},
		{"title":"공중 사격","keys":["Space","KeyJ"],"dummy":300,"desc":"공중에서는 아래 30°로 쏘며 천천히 내려옵니다. 땅에 닿으면 착지합니다.","script":[["tap","Space",200],["tap","KeyJ",470],["tap","KeyJ",820]],"setup":null},
		{"title":"근접 콤보","keys":["KeyH"],"dummy":80,"desc":"가까이 붙은 적을 활로 세 번 후려칩니다.","script":[["tap","KeyH",250],["tap","KeyH",520],["tap","KeyH",790]],"setup":null},
		{"title":"화살 연사","keys":["KeyU"],"dummy":320,"desc":"6발 연사 (발당 10 피해). 위/아래 키로 사격 줄을 조절할 수 있습니다.","script":[["tap","KeyU",250]],"setup":null},
		{"title":"대시 → 지상 백플립","keys":["KeyO"],"dummy":200,"desc":"대시로 적을 꿰뚫고 착지 충격으로 넘어뜨린 뒤 땅에서 백플립. 대시 중 무적이며 적마다 20 추가 피해.","script":[["tap","KeyO",250]],"setup":null},
		{"title":"대시 → 공중 백플립","keys":["KeyP","KeyJ"],"dummy":200,"desc":"높은 백플립 후 최대 40틱 체공. 체공 중 공격 키로 사격을 이어갑니다. 공중에서도 착지 전 한 번 쓸 수 있습니다.","script":[["tap","KeyP",250],["tap","KeyJ",1100],["tap","KeyJ",1400]],"setup":null},
		{"title":"모아 쏘기","keys":["KeyL"],"dummy":420,"desc":"시위를 끝까지 당긴 자세로 누르고 있으면 최대 3단까지 모읍니다. 단계마다 피해 +4, 놓으면 관통 사격. 3단 뒤 잠시 지나면 자동 발사.","script":[["hold","KeyL",250,1700]],"setup":null},
		{"title":"필살기 흑월 난사","keys":["KeyK"],"dummy":260,"desc":"SP 100에서 사용. 공중 도약 → 마법진 → 환영 화살 200발 → 거대 화살 폭발. 시전 전체 무적.","script":[["tap","KeyK",350]],"setup":{"sp":100}},
		{"title":"마법 뇌격","keys":["KeyI"],"dummy":260,"desc":"두루마리 1개로 화면 안의 모든 적에게 번개! 두루마리는 최대 3개까지 모입니다.","script":[["tap","KeyI",350]],"setup":{"mg":1}},
	],
}
