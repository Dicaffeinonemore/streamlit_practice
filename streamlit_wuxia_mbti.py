"""죽림무협 MBTI - 무협 세계관으로 성향을 살펴보는 Streamlit 앱.

실행:
    streamlit run streamlit_wuxia_mbti.py

재미와 자기 탐색을 위한 간이 활동이며, 공식 MBTI 검사나 심리 진단이 아닙니다.
"""

import base64

import streamlit as st

st.set_page_config(page_title="죽림무협 MBTI", page_icon="🎋", layout="centered")


# ---------------------------------------------------------------------------
# 배경: 대나무 숲(죽림) SVG를 코드로 생성해 CSS 배경으로 사용
# ---------------------------------------------------------------------------
def make_bamboo_svg():
    stalks = [
        (40, 46, 0), (130, 30, 1), (215, 52, 2), (330, 34, 0), (420, 44, 1),
        (520, 28, 2), (610, 50, 0), (710, 36, 1), (800, 46, 2), (905, 30, 0),
        (990, 52, 1), (1090, 38, 2), (1160, 28, 0),
    ]
    palette = [("#2f5d34", "#1f4126"), ("#3f7a43", "#295a30"), ("#27502d", "#173a1e")]
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" '
        'preserveAspectRatio="xMidYMid slice">',
        '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#cfe3c8"/><stop offset="1" stop-color="#7fa77f"/>'
        "</linearGradient></defs>",
        '<rect width="1200" height="800" fill="url(#sky)"/>',
    ]
    # 먼 대숲(옅은 색)
    for i in range(18):
        x = 30 + i * 68
        parts.append(f'<rect x="{x}" y="0" width="14" height="800" fill="#9bbf9a" opacity="0.55"/>')
    # 가까운 대나무 줄기
    for x, w, c in stalks:
        light, dark = palette[c]
        parts.append(
            f'<rect x="{x}" y="0" width="{w}" height="800" fill="{dark}"/>'
            f'<rect x="{x}" y="0" width="{w * 0.45:.0f}" height="800" fill="{light}"/>'
        )
        y = 70 + (x % 53)
        while y < 800:
            parts.append(
                f'<rect x="{x - 3}" y="{y}" width="{w + 6}" height="6" rx="3" fill="#163319"/>'
            )
            y += 118 + (x % 37)
        # 댓잎
        for k in range(5):
            ly = 120 + k * 150 + (x % 40)
            parts.append(
                f'<path d="M{x + w} {ly} q70 -28 130 12 q-70 8 -130 -12z" fill="#4c8a4f" opacity="0.8"/>'
                f'<path d="M{x} {ly + 40} q-70 -28 -130 12 q70 8 130 -12z" fill="#3c7a40" opacity="0.8"/>'
            )
    parts.append("</svg>")
    return "".join(parts)


BAMBOO_B64 = base64.b64encode(make_bamboo_svg().encode("utf-8")).decode("ascii")

st.markdown(
    f"""
    <style>
    .stApp {{
        background:
            linear-gradient(180deg, rgba(235,245,230,0.35) 0%, rgba(20,45,25,0.35) 100%),
            url("data:image/svg+xml;base64,{BAMBOO_B64}");
        background-size: cover;
        background-attachment: fixed;
    }}
    header[data-testid="stHeader"] {{ background: transparent; }}
    .block-container {{
        background: rgba(248, 244, 228, 0.93);
        border: 1px solid rgba(90, 70, 40, 0.35);
        border-radius: 22px;
        box-shadow: 0 10px 40px rgba(10, 30, 15, 0.45);
        padding: 2.2rem 2.2rem 2.5rem 2.2rem !important;
        margin-top: 2rem;
        margin-bottom: 2rem;
        color: #2c2a1e;
    }}
    .block-container h1, .block-container h2, .block-container h3,
    .block-container p, .block-container li, .block-container span,
    .block-container label, .block-container div[data-testid="stMarkdownContainer"] {{
        color: #2c2a1e;
    }}
    div[data-testid="stButton"] button {{
        border-radius: 14px;
        transition: transform 120ms ease, box-shadow 120ms ease;
    }}
    div.st-key-card_option_0 button, div.st-key-card_option_1 button,
    div.st-key-card_option_2 button, div.st-key-card_option_3 button {{
        min-height: 150px !important;
        height: auto !important;
        padding: 18px !important;
        text-align: left !important;
        white-space: normal !important;
        overflow: visible !important;
        justify-content: flex-start !important;
        align-items: center !important;
        font-size: 1.02rem !important;
        line-height: 1.55 !important;
        border-radius: 18px !important;
        background: #fffdf3;
        color: #2c2a1e !important;
        border: 1px solid #b9a97c !important;
        box-shadow: 0 3px 12px rgba(40, 50, 30, 0.12);
    }}
    div.st-key-card_option_0 button *, div.st-key-card_option_1 button *,
    div.st-key-card_option_2 button *, div.st-key-card_option_3 button * {{
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: clip !important;
        word-break: keep-all !important;
        overflow-wrap: anywhere !important;
        text-align: left !important;
        width: 100%;
    }}
    div.st-key-card_option_0 button:hover, div.st-key-card_option_1 button:hover,
    div.st-key-card_option_2 button:hover, div.st-key-card_option_3 button:hover {{
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(40, 50, 30, 0.22);
    }}
    div.st-key-card_option_0 button[kind="primary"], div.st-key-card_option_1 button[kind="primary"],
    div.st-key-card_option_2 button[kind="primary"], div.st-key-card_option_3 button[kind="primary"] {{
        background: #2f6b3a !important;
        color: #fffdf3 !important;
        border-color: #1f4a28 !important;
    }}
    .scene {{
        background: rgba(47, 107, 58, 0.10);
        border-left: 4px solid #2f6b3a;
        padding: 12px 16px;
        border-radius: 8px;
        margin: 6px 0 14px 0;
        font-style: italic;
    }}
    .bar-row {{ margin: 8px 0 14px 0; }}
    .bar-label {{ display:flex; justify-content:space-between; font-weight:700; font-size:0.95rem; }}
    .bar-track {{ background:#e4dcc0; border-radius:999px; height:14px; overflow:hidden; margin-top:4px; }}
    .bar-fill {{ height:100%; border-radius:999px; background: linear-gradient(90deg,#2f6b3a,#7bb26f); }}
    .bar-fill.f1 {{ background: linear-gradient(90deg,#2c5aa0,#7aa7e0); }}
    .bar-fill.f2 {{ background: linear-gradient(90deg,#8a6d1c,#d8b64e); }}
    .bar-fill.f3 {{ background: linear-gradient(90deg,#7a1f2b,#d0576a); }}
    .type-card {{
        background: #fffdf3; border: 2px solid #8b7a4b; border-radius: 18px;
        padding: 18px 22px; margin: 10px 0 18px 0; text-align: center;
    }}
    .type-card .code {{ font-size: 2.6rem; font-weight: 800; letter-spacing: 6px; color:#2f6b3a; }}
    .type-card .title {{ font-size: 1.4rem; font-weight: 700; }}
    .type-card .tag {{ color:#6b6244; margin-top:4px; }}
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# 문항: 각 선택지 = (MBTI 글자, 가중치(2=뚜렷, 1=약함), 성향 문파, 문구)
# ---------------------------------------------------------------------------
FACTIONS = ["정파", "사파", "마교"]

QUESTIONS = [
    # ---- E / I ----
    {
        "id": "ei_1", "axis": "에너지 방향", "pair": ("I", "E"),
        "scene": "달빛이 대숲 사이로 스며드는 밤, 죽림 한가운데서 하룻밤을 지새우게 되었다.",
        "prompt": "나는 이 밤을 어떻게 보내나요?",
        "options": [
            ("I", 2, "정파", "홀로 대숲 깊이 들어가 검을 닦으며 고요히 내공을 가다듬는다."),
            ("E", 2, "사파", "모닥불 곁에 모인 무인들과 술잔을 기울이며 강호의 소문을 나눈다."),
            ("I", 1, "마교", "일행 곁에 있되 말없이 달빛 아래서 운공에 잠긴다."),
            ("E", 1, "정파", "처음 보는 이에게도 먼저 말을 걸어 하룻밤 동행을 청한다."),
        ],
    },
    {
        "id": "ei_2", "axis": "에너지 방향", "pair": ("I", "E"),
        "scene": "보름 뒤, 천하의 고수들이 모이는 비무대회가 열린다.",
        "prompt": "나는 어떻게 대회를 준비하나요?",
        "options": [
            ("E", 2, "사파", "동료들과 연무장에서 서로 겨루고 떠들며 감각을 끌어올린다."),
            ("I", 2, "정파", "홀로 초식을 되짚으며 머릿속으로 수십 번의 비무를 그려본다."),
            ("E", 1, "마교", "사형제들을 모아 사기를 북돋우고 함께 결의를 다진다."),
            ("I", 1, "사파", "아무에게도 알리지 않고 남들이 모르는 수를 은밀히 연마한다."),
        ],
    },
    {
        "id": "ei_3", "axis": "에너지 방향", "pair": ("I", "E"),
        "scene": "무림 각 파가 한자리에 모인 대회합 연회. 수백 명의 무인이 술과 말을 주고받는다.",
        "prompt": "나는 연회장에서 어떤 모습인가요?",
        "options": [
            ("I", 2, "마교", "구석 자리에서 사람들의 기세와 움직임을 조용히 살핀다."),
            ("E", 1, "사파", "가까운 몇 사람과 시끌벅적하게 술판을 벌인다."),
            ("E", 2, "정파", "여러 문파의 인사와 두루 인사를 나누며 인맥을 넓힌다."),
            ("I", 1, "정파", "꼭 필요한 인사만 마치고 일찌감치 자리를 뜬다."),
        ],
    },
    # ---- S / N ----
    {
        "id": "sn_1", "axis": "정보 인식", "pair": ("S", "N"),
        "scene": "죽림 속 폐허에서 오래된 비급 한 권을 주웠다.",
        "prompt": "나는 비급을 어떻게 익히나요?",
        "options": [
            ("N", 2, "사파", "초식 이면의 원리를 파악해 나만의 변형을 만들어낸다."),
            ("S", 2, "정파", "그림 순서대로 자세와 호흡 하나하나를 정확히 따라 익힌다."),
            ("S", 1, "마교", "일단 실전에서 몸으로 부딪혀 감각으로 익힌다."),
            ("N", 1, "정파", "비급 전체의 흐름과 창시자가 남기려 한 뜻부터 헤아린다."),
        ],
    },
    {
        "id": "sn_2", "axis": "정보 인식", "pair": ("S", "N"),
        "scene": "해 질 녘, 낯선 강호의 마을에 들어섰다.",
        "prompt": "가장 먼저 눈에 들어오는 것은?",
        "options": [
            ("N", 1, "정파", "이곳이 훗날 어떤 세력의 거점이 될지 상상해 본다."),
            ("S", 2, "사파", "객잔의 위치, 출입구, 사람들이 찬 무기까지 눈에 들어온다."),
            ("N", 2, "마교", "마을에 감도는 묘한 기운과 숨은 사연이 먼저 느껴진다."),
            ("S", 1, "정파", "묵을 곳과 먹을거리, 남은 노잣돈부터 확인한다."),
        ],
    },
    {
        "id": "sn_3", "axis": "정보 인식", "pair": ("S", "N"),
        "scene": "큰 싸움을 치르고 돌아와 사제들이 무용담을 청한다.",
        "prompt": "나는 어떻게 이야기하나요?",
        "options": [
            ("S", 2, "마교", "누가 어디서 어떤 초식을 썼는지 장면을 생생하게 재현한다."),
            ("N", 1, "사파", "그 싸움이 무엇을 닮았는지 비유와 고사로 풀어낸다."),
            ("N", 2, "정파", "그 싸움이 보여준 강호의 흐름과 숨은 의미를 이야기한다."),
            ("S", 1, "사파", "있었던 일을 순서대로 담담하게 전한다."),
        ],
    },
    # ---- T / F ----
    {
        "id": "tf_1", "axis": "판단 기준", "pair": ("T", "F"),
        "scene": "사파의 고수가 패배 끝에 무릎을 꿇고 목숨을 구걸한다.",
        "prompt": "나는 어떻게 처결하나요?",
        "options": [
            ("T", 2, "정파", "무림의 율법대로 처결한다. 예외를 두면 법도가 무너진다."),
            ("F", 2, "사파", "그가 처한 사정과 남겨질 식솔을 먼저 헤아려 살려준다."),
            ("T", 1, "마교", "살려둘 때와 죽일 때의 득실을 따져 이로운 쪽을 택한다."),
            ("F", 1, "마교", "그가 진심으로 뉘우치는지 눈빛과 마음부터 읽어본다."),
        ],
    },
    {
        "id": "tf_2", "axis": "판단 기준", "pair": ("T", "F"),
        "scene": "사제가 실수로 문파의 귀한 비급 일부를 훼손해 버렸다.",
        "prompt": "나는 어떻게 대하나요?",
        "options": [
            ("F", 2, "정파", "놀란 사제의 마음부터 달래고 함께 수습할 방법을 찾는다."),
            ("T", 2, "사파", "원인을 분석해 책임을 가리고 재발 방지책을 세운다."),
            ("T", 1, "정파", "사실 그대로 장문인께 보고하되 감정은 섞지 않는다."),
            ("F", 1, "마교", "혼자 몰래 복원해 주고 아무에게도 알리지 않는다."),
        ],
    },
    {
        "id": "tf_3", "axis": "판단 기준", "pair": ("T", "F"),
        "scene": "정파와 마교가 충돌 직전, 나에게 중재를 맡겼다.",
        "prompt": "나는 무엇부터 살피나요?",
        "options": [
            ("T", 1, "마교", "이해관계를 냉정히 계산해 양측이 받아들일 거래를 만든다."),
            ("F", 2, "정파", "양측 사람들이 입게 될 상처와 잃을 것들을 먼저 살핀다."),
            ("F", 1, "사파", "양쪽 모두 자존심이 상하지 않을 길을 찾는다."),
            ("T", 2, "사파", "누구의 말이 사실에 부합하는지 증거와 논리로 따진다."),
        ],
    },
    # ---- J / P ----
    {
        "id": "jp_1", "axis": "생활 방식", "pair": ("J", "P"),
        "scene": "멀리 있는 문파를 찾아 길고 위험한 여정에 오르게 되었다.",
        "prompt": "나는 어떻게 길을 준비하나요?",
        "options": [
            ("J", 2, "정파", "출발 전에 경로와 일정, 보급을 빈틈없이 짜둔다."),
            ("P", 2, "사파", "바람 부는 대로 가며 눈에 띄는 인연을 따른다."),
            ("J", 1, "마교", "큰 목표와 기한만 정하고 나머지는 밀어붙이며 해결한다."),
            ("P", 1, "정파", "대략의 방향만 잡고 상황을 보며 길을 조정한다."),
        ],
    },
    {
        "id": "jp_2", "axis": "생활 방식", "pair": ("J", "P"),
        "scene": "강호에 갑작스러운 변고가 터졌다. 아무도 이런 일을 예상하지 못했다.",
        "prompt": "나는 어떻게 움직이나요?",
        "options": [
            ("P", 2, "마교", "계획에 얽매이지 않고 즉흥으로 판을 뒤집는다."),
            ("J", 2, "정파", "정해둔 대응 절차에 따라 질서 있게 움직인다."),
            ("P", 1, "사파", "일단 지켜보며 가장 좋은 때를 기다린다."),
            ("J", 1, "사파", "먼저 역할을 나누고 순서를 정한 뒤에야 움직인다."),
        ],
    },
    {
        "id": "jp_3", "axis": "생활 방식", "pair": ("J", "P"),
        "scene": "문파의 임무가 한꺼번에 여러 건 쌓였다.",
        "prompt": "나는 어떻게 처리하나요?",
        "options": [
            ("J", 2, "마교", "중요도 순으로 줄을 세워 하나씩 끝내 나간다."),
            ("P", 2, "정파", "손에 잡히는 대로 오가며 흐름과 기분에 맞춰 처리한다."),
            ("P", 1, "사파", "마감이 코앞에 닥쳤을 때 몰입이 폭발한다."),
            ("J", 1, "사파", "미리미리 해치워 남은 일 없이 후련하게 만든다."),
        ],
    },
]

AXIS_NAMES = {
    ("I", "E"): ("내공의 근원", "I 고요 수련", "E 교류 수련"),
    ("S", "N"): ("안목", "S 현실 · 세부", "N 이치 · 가능성"),
    ("T", "F"): ("검의 기준", "T 법도 · 이치", "F 인정 · 의리"),
    ("J", "P"): ("행보", "J 계획 · 질서", "P 임기응변 · 자유"),
}

# ---------------------------------------------------------------------------
# 16유형 무림 풀이
# ---------------------------------------------------------------------------
TYPES = {
    "ISTJ": ("집법당(執法堂) 장로", "법도를 몸으로 지키는 강호의 기둥",
             "한 번 맺은 약속은 목숨처럼 지키고, 문파의 규율과 전통을 묵묵히 떠받치는 사람입니다. 화려한 초식보다 수천 번 반복한 기본기를 믿으며, 그가 서 있는 자리는 늘 흔들림이 없습니다.",
             "신뢰할 수 있고 책임감이 강하며 맡은 일은 반드시 끝을 봅니다.",
             "변칙적인 상대나 낯선 상황 앞에서는 고지식해 보일 수 있습니다."),
    "ISFJ": ("약왕곡(藥王谷) 의원", "조용히 모두를 지켜내는 수호자",
             "앞에 나서지 않지만 문파 사람들의 상처와 사정을 가장 먼저 알아채 돌보는 사람입니다. 이름이 널리 알려지지 않아도 그가 있었기에 살아난 이들이 강호에 가득합니다.",
             "세심하고 헌신적이며 한 번 마음 준 사람을 끝까지 지킵니다.",
             "자신의 고통은 숨기고 혼자 짊어지기 쉽습니다."),
    "INFJ": ("죽림의 은거 현자", "먼 앞날을 내다보는 심안(心眼)의 도인",
             "말수는 적지만 사람의 마음과 강호의 흐름을 꿰뚫어 보는 은거 고수입니다. 때가 오면 한마디로 판세를 바꾸고, 신념에 어긋나는 일에는 누구 앞에서도 물러서지 않습니다.",
             "통찰력이 깊고 이상과 의리를 함께 품고 있습니다.",
             "마음의 짐을 홀로 오래 끌어안고 고립되기 쉽습니다."),
    "INTJ": ("암중 군사(軍師)", "수십 수 앞을 읽는 무림의 책사",
             "검을 뽑기 전에 이미 싸움의 결과를 그려두는 전략가입니다. 감정에 휘둘리지 않고 큰 판을 짜며, 목적을 이루기 위해서라면 정파든 사파든 가리지 않고 수를 씁니다.",
             "냉철한 분석력과 장기적 안목, 흔들리지 않는 집념을 가졌습니다.",
             "사람의 마음을 계산 밖에 두다 동료를 잃을 수 있습니다."),
    "ISTP": ("대숲의 고독한 검객", "말보다 검으로 답하는 장인",
             "필요한 순간에만 움직이고 군더더기 없는 일격으로 승부를 끝내는 고수입니다. 소속과 명분에는 무심하지만 눈앞의 문제를 해결하는 솜씨는 누구보다 정확합니다.",
             "침착하고 실전 감각이 뛰어나며 위기에서 오히려 냉정해집니다.",
             "속마음을 거의 드러내지 않아 오해를 받기도 합니다."),
    "ISFP": ("죽림의 검무(劍舞) 낭인", "바람처럼 자유로운 풍류 검객",
             "대나무 사이에서 홀로 검무를 추며 마음을 다스리는 낭인입니다. 권력과 명예에는 관심이 없지만, 아끼는 사람이 위협받으면 누구보다 빠르게 검을 뽑습니다.",
             "온화하고 감성이 풍부하며 자기만의 신념이 단단합니다.",
             "갈등을 피해 떠나버려 중요한 순간을 놓칠 때가 있습니다."),
    "INFP": ("방랑 시객(詩客) 협사", "이상을 품고 강호를 떠도는 낭만 협객",
             "시 한 수와 술 한 병을 벗 삼아 천하를 떠돌며 '진짜 협(俠)'이 무엇인지 묻는 사람입니다. 문파의 이익보다 자신의 신념이 옳은가를 먼저 따지며, 마음이 움직이면 불리해도 앞장섭니다.",
             "순수한 이상과 깊은 공감 능력으로 사람의 마음을 움직입니다.",
             "현실의 벽 앞에서 쉽게 상처받고 행동이 늦어질 수 있습니다."),
    "INTP": ("장경각(藏經閣) 기재", "초식의 이치를 파고드는 무학 연구자",
             "수만 권의 비급 속에서 새로운 이치를 찾아내는 괴짜 천재입니다. 실전보다 원리를 파고드는 쪽에 흥미가 있고, 이 사람이 한 번 깨달음을 얻으면 문파의 무공이 통째로 바뀌기도 합니다.",
             "독창적이고 분석적이며 기존 틀을 의심할 줄 압니다.",
             "생각만 길어지고 실행과 인간관계는 뒷전이 되기 쉽습니다."),
    "ESTP": ("쾌검(快劍) 풍운아", "위기에서 더 빛나는 승부사",
             "고민할 시간에 이미 칼을 뽑고 있는 행동파입니다. 판이 뒤집히는 순간 감각이 극대화되고, 어디서든 사람들을 끌어모아 분위기를 장악하는 강호의 풍운아입니다.",
             "대담하고 임기응변이 탁월하며 현장 장악력이 뛰어납니다.",
             "뒷일을 가볍게 보다가 같은 실수를 반복할 수 있습니다."),
    "ESFP": ("강호의 풍류객", "어디서든 중심이 되는 분위기 메이커",
             "객잔에 들어서면 순식간에 사람들이 모여드는 타고난 풍류객입니다. 검술도 화려하고 입담도 좋아 강호의 소문 한복판에 늘 이 사람이 있으며, 곁에 있는 이들의 사기를 높입니다.",
             "밝고 친화력이 좋으며 현재를 온전히 즐길 줄 압니다.",
             "당장의 즐거움에 이끌려 장기적인 준비를 놓칠 수 있습니다."),
    "ENFP": ("자유로운 협객", "인연을 몰고 다니는 열정의 방랑자",
             "새로운 인연과 새로운 길에 가슴이 뛰는 사람입니다. 가는 곳마다 벗이 생기고, 불가능해 보이는 일에도 '해볼 만하다'며 사람들을 끌어들이는 강호의 불씨입니다.",
             "열정과 상상력이 넘치고 사람의 가능성을 잘 알아봅니다.",
             "관심이 여기저기로 옮겨 다니며 마무리가 약할 수 있습니다."),
    "ENTP": ("천변만화(千變萬化) 책사", "판을 흔들기 좋아하는 변칙의 귀재",
             "정석을 알면서도 일부러 비틀어 상대의 허를 찌르는 변칙의 고수입니다. 논쟁과 도전을 즐기고, 어느 문파에도 얽매이지 않으면서 판세를 뒤흔드는 재주가 있습니다.",
             "재치와 기발한 발상으로 막다른 상황도 돌파합니다.",
             "흥미가 식으면 하던 일을 던지고 약속을 가볍게 여길 수 있습니다."),
    "ESTJ": ("총관(總管) 호법", "문파의 질서를 세우는 실무형 지휘관",
             "문파의 살림과 조직을 빈틈없이 굴리는 지휘관입니다. 기준이 분명하고 결단이 빨라 위기에도 조직이 흩어지지 않게 하며, 자신에게도 남에게도 엄격합니다.",
             "추진력과 조직 운영 능력이 뛰어나며 공정함을 중시합니다.",
             "원칙을 앞세우다 사람의 사정을 놓쳐 반발을 살 수 있습니다."),
    "ESFJ": ("객잔의 안주인 · 문파의 큰사형", "사람을 모으고 보듬는 강호의 인정(人情)",
             "문파 사람들의 생일과 사정까지 챙기는 정 많은 사람입니다. 이 사람이 있는 곳에는 늘 따뜻한 밥상과 사람들이 모이며, 문파가 하나로 뭉치게 하는 숨은 구심점입니다.",
             "배려심이 깊고 협동을 이끌어내며 분위기를 따뜻하게 만듭니다.",
             "주변의 평판과 시선에 지나치게 신경 쓸 수 있습니다."),
    "ENFJ": ("협의(俠義)의 맹주", "사람을 이끌어 큰 뜻을 이루는 지도자",
             "말 한마디로 흩어진 무인들을 하나로 모으는 카리스마형 지도자입니다. 개개인의 장점을 알아보고 키워주며, 정의를 위해서라면 앞장서 책임을 지는 맹주의 그릇입니다.",
             "공감과 리더십을 겸비해 사람들이 스스로 따르게 만듭니다.",
             "모두를 책임지려다 자신을 소진시키기 쉽습니다."),
    "ENTJ": ("천하 패주(霸主) · 장문인", "큰 판을 짜고 밀어붙이는 야망의 지휘관",
             "강호의 판도를 읽고 세력을 일으켜 세우는 타고난 통솔자입니다. 목표가 정해지면 인재와 자원을 모아 정면 돌파하며, 약한 문파도 이 사람 손에서는 일류가 됩니다.",
             "결단력과 전략, 추진력이 뛰어나 조직을 크게 키웁니다.",
             "독선적으로 보이거나 주변을 몰아붙이는 면이 있습니다."),
}

FACTION_TEXT = {
    "정파": (
        "명문정파(名門正派)의 기운",
        "당신의 선택에는 명분, 질서, 그리고 책임이 짙게 배어 있습니다. 소림·무당·화산 같은 정파의 가치처럼 옳은 길을 지키려는 마음이 강해, 어려운 상황에서도 원칙을 놓지 않으려 합니다. 다만 지나친 명분은 때로 융통성을 가로막으니, 사파의 유연함에서 배울 점도 있을 것입니다.",
    ),
    "사파": (
        "자유로운 사파(邪派)의 기운",
        "당신의 선택에는 실리와 자유, 그리고 스스로의 길이 짙게 배어 있습니다. 틀에 얽매이지 않고 실제로 통하는 방법을 택하며, 문파의 간판보다 자기 눈으로 본 것을 믿습니다. 사파라고 해서 악한 것은 아닙니다. 다만 홀로 가는 길이 길어지면 믿을 수 있는 동료가 필요해질 것입니다.",
    ),
    "마교": (
        "열정의 마교(魔敎)의 기운",
        "당신의 선택에는 강렬한 신념과 결속, 그리고 한계를 넘으려는 의지가 짙게 배어 있습니다. 세상의 평가보다 자신이 믿는 이상과 사람을 위해 모든 것을 거는 쪽에 가깝습니다. 그 열정은 큰 힘이 되지만, 신념이 지나치면 주변이 두려워할 수 있으니 때로는 칼끝을 늦추는 지혜가 필요합니다.",
    ),
}


# ---------------------------------------------------------------------------
# 상태 및 계산
# ---------------------------------------------------------------------------
def initialize_state():
    st.session_state.setdefault("current_index", 0)
    st.session_state.setdefault("answers", {})  # question id -> option index
    st.session_state.setdefault("completed", False)


def restart_test():
    st.session_state.current_index = 0
    st.session_state.answers = {}
    st.session_state.completed = False


def calculate_results(answers):
    letters = []
    axis_results = []
    faction_count = {f: 0 for f in FACTIONS}

    for start in range(0, len(QUESTIONS), 3):
        group = QUESTIONS[start : start + 3]
        a, b = group[0]["pair"]
        score = {a: 0, b: 0}
        last_letter = None
        for q in group:
            letter, weight, faction, _ = q["options"][answers[q["id"]]]
            score[letter] += weight
            faction_count[faction] += 1
            last_letter = letter
        if score[a] == score[b]:
            winner = last_letter  # 동점이면 마지막 문항의 선택을 따름
        else:
            winner = a if score[a] > score[b] else b
        letters.append(winner)
        axis_results.append({"pair": (a, b), "score": score, "winner": winner})

    faction = max(FACTIONS, key=lambda f: faction_count[f])
    return "".join(letters), axis_results, faction, faction_count


def bar(label_left, label_right, left_val, right_val, css_class=""):
    total = max(left_val + right_val, 1)
    pct = left_val / total * 100
    return (
        f'<div class="bar-row"><div class="bar-label"><span>{label_left} · {left_val}</span>'
        f"<span>{right_val} · {label_right}</span></div>"
        f'<div class="bar-track"><div class="bar-fill {css_class}" style="width:{pct:.0f}%"></div></div></div>'
    )


def show_result():
    code, axis_results, faction, faction_count = calculate_results(st.session_state.answers)
    title, tagline, desc, strength, caution = TYPES[code]
    faction_title, faction_desc = FACTION_TEXT[faction]

    st.progress(1.0, text="모든 시련을 마쳤습니다")
    st.markdown(
        f'<div class="type-card"><div class="code">{code}</div>'
        f'<div class="title">🎋 {title}</div><div class="tag">{tagline}</div></div>',
        unsafe_allow_html=True,
    )

    st.subheader("무림에서의 당신")
    st.write(desc)
    st.markdown(f"**✨ 강점** · {strength}")
    st.markdown(f"**⚠️ 경계할 점** · {caution}")

    st.subheader(f"문파 성향 · {faction_title}")
    st.write(faction_desc)
    classes = {"정파": "f1", "사파": "f2", "마교": "f3"}
    max_f = max(max(faction_count.values()), 1)
    rows = ""
    for f in FACTIONS:
        n = faction_count[f]
        rows += (
            f'<div class="bar-row"><div class="bar-label"><span>{f}</span><span>{n}회 선택</span></div>'
            f'<div class="bar-track"><div class="bar-fill {classes[f]}" style="width:{n / max_f * 100:.0f}%"></div></div></div>'
        )
    st.markdown(rows, unsafe_allow_html=True)

    st.subheader("네 가지 수련 경향")
    html = ""
    for item in axis_results:
        a, b = item["pair"]
        name, left, right = AXIS_NAMES[item["pair"]]
        html += f"<b>{name}</b>" + bar(left, right, item["score"][a], item["score"][b])
    st.markdown(html, unsafe_allow_html=True)
    st.caption("막대는 각 차원에서 선택한 답의 가중 점수 비율이며, 성향의 강도를 뜻하지 않습니다.")

    st.info("이 페이지는 무협 세계관을 빌린 재미용 자기 탐색 활동이며, 공식 MBTI 검사나 심리 진단이 아닙니다.")
    if st.button("🔄 다시 강호에 나서기", use_container_width=True, key="restart_result"):
        restart_test()
        st.rerun()


# ---------------------------------------------------------------------------
# 화면
# ---------------------------------------------------------------------------
initialize_state()

st.title("🎋 죽림무협 MBTI")
st.write("대나무 숲이 우거진 죽림에서 정파, 사파, 마교가 얽힌 강호의 상황을 마주합니다. 가장 나다운 선택을 골라보세요.")
st.caption("총 12문항 · 문항마다 선택지 4개 · 정답은 없어요")

if st.session_state.completed:
    show_result()
else:
    idx = st.session_state.current_index
    question = QUESTIONS[idx]
    selected = st.session_state.answers.get(question["id"])
    answered = len(st.session_state.answers)

    st.progress(answered / len(QUESTIONS), text=f"수련 진행 · {answered}/{len(QUESTIONS)}")
    st.caption(f"제 {idx + 1} 장 / {len(QUESTIONS)} · {question['axis']}")
    st.markdown(f'<div class="scene">{question["scene"]}</div>', unsafe_allow_html=True)
    st.subheader(question["prompt"])

    for row_start in (0, 2):
        cols = st.columns(2, gap="medium")
        for offset, col in enumerate(cols):
            i = row_start + offset
            _, _, _, text = question["options"][i]
            is_selected = selected == i
            with col:
                st.markdown(f"**{'①②③④'[i]}**")
                if st.button(
                    f"{'✓  ' if is_selected else ''}{text}",
                    key=f"card_option_{i}",
                    type="primary" if is_selected else "secondary",
                    use_container_width=True,
                ):
                    st.session_state.answers[question["id"]] = i
                    st.rerun()

    st.divider()
    prev_col, next_col = st.columns(2)
    is_last = idx == len(QUESTIONS) - 1
    with prev_col:
        prev_clicked = st.button("← 이전", disabled=idx == 0, use_container_width=True, key="previous_question")
    with next_col:
        next_clicked = st.button(
            "결과 보기 ✨" if is_last else "다음 →",
            disabled=selected is None,
            use_container_width=True,
            type="primary",
            key="next_question",
        )

    if prev_clicked:
        st.session_state.current_index -= 1
        st.rerun()
    if next_clicked:
        if is_last:
            st.session_state.completed = True
        else:
            st.session_state.current_index += 1
        st.rerun()

    if selected is None:
        st.caption("다음으로 가려면 선택지를 먼저 골라주세요.")

    if st.button("처음부터 다시 하기", key="restart_quiz", use_container_width=True):
        restart_test()
        st.rerun()
