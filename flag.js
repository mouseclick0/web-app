/* Flag quiz: show a flag, pick 1 of 4 countries, reveal capital */
(function () {
  "use strict";

  // tier 1 = well-known, 2 = medium, 3 = less common
  var COUNTRIES = [
    { code: "kr", tier: 1, ko: { name: "대한민국", capital: "서울" }, en: { name: "South Korea", capital: "Seoul" } },
    { code: "jp", tier: 1, ko: { name: "일본", capital: "도쿄" }, en: { name: "Japan", capital: "Tokyo" } },
    { code: "cn", tier: 1, ko: { name: "중국", capital: "베이징" }, en: { name: "China", capital: "Beijing" } },
    { code: "us", tier: 1, ko: { name: "미국", capital: "워싱턴 D.C." }, en: { name: "United States", capital: "Washington, D.C." } },
    { code: "gb", tier: 1, ko: { name: "영국", capital: "런던" }, en: { name: "United Kingdom", capital: "London" } },
    { code: "fr", tier: 1, ko: { name: "프랑스", capital: "파리" }, en: { name: "France", capital: "Paris" } },
    { code: "de", tier: 1, ko: { name: "독일", capital: "베를린" }, en: { name: "Germany", capital: "Berlin" } },
    { code: "it", tier: 1, ko: { name: "이탈리아", capital: "로마" }, en: { name: "Italy", capital: "Rome" } },
    { code: "es", tier: 1, ko: { name: "스페인", capital: "마드리드" }, en: { name: "Spain", capital: "Madrid" } },
    { code: "ca", tier: 1, ko: { name: "캐나다", capital: "오타와" }, en: { name: "Canada", capital: "Ottawa" } },
    { code: "au", tier: 1, ko: { name: "호주", capital: "캔버라" }, en: { name: "Australia", capital: "Canberra" } },
    { code: "br", tier: 1, ko: { name: "브라질", capital: "브라질리아" }, en: { name: "Brazil", capital: "Brasília" } },
    { code: "in", tier: 1, ko: { name: "인도", capital: "뉴델리" }, en: { name: "India", capital: "New Delhi" } },
    { code: "ru", tier: 1, ko: { name: "러시아", capital: "모스크바" }, en: { name: "Russia", capital: "Moscow" } },
    { code: "mx", tier: 1, ko: { name: "멕시코", capital: "멕시코시티" }, en: { name: "Mexico", capital: "Mexico City" } },
    { code: "ar", tier: 1, ko: { name: "아르헨티나", capital: "부에노스아이레스" }, en: { name: "Argentina", capital: "Buenos Aires" } },
    { code: "tr", tier: 1, ko: { name: "튀르키예", capital: "앙카라" }, en: { name: "Türkiye", capital: "Ankara" } },
    { code: "sa", tier: 1, ko: { name: "사우디아라비아", capital: "리야드" }, en: { name: "Saudi Arabia", capital: "Riyadh" } },
    { code: "eg", tier: 1, ko: { name: "이집트", capital: "카이로" }, en: { name: "Egypt", capital: "Cairo" } },
    { code: "za", tier: 1, ko: { name: "남아프리카공화국", capital: "프리토리아" }, en: { name: "South Africa", capital: "Pretoria" } },
    { code: "nl", tier: 1, ko: { name: "네덜란드", capital: "암스테르담" }, en: { name: "Netherlands", capital: "Amsterdam" } },
    { code: "se", tier: 1, ko: { name: "스웨덴", capital: "스톡홀름" }, en: { name: "Sweden", capital: "Stockholm" } },
    { code: "ch", tier: 1, ko: { name: "스위스", capital: "베른" }, en: { name: "Switzerland", capital: "Bern" } },
    { code: "sg", tier: 1, ko: { name: "싱가포르", capital: "싱가포르" }, en: { name: "Singapore", capital: "Singapore" } },
    { code: "th", tier: 1, ko: { name: "태국", capital: "방콕" }, en: { name: "Thailand", capital: "Bangkok" } },
    { code: "vn", tier: 1, ko: { name: "베트남", capital: "하노이" }, en: { name: "Vietnam", capital: "Hanoi" } },
    { code: "ph", tier: 1, ko: { name: "필리핀", capital: "마닐라" }, en: { name: "Philippines", capital: "Manila" } },
    { code: "id", tier: 1, ko: { name: "인도네시아", capital: "자카르타" }, en: { name: "Indonesia", capital: "Jakarta" } },
    { code: "my", tier: 1, ko: { name: "말레이시아", capital: "쿠알라룸푸르" }, en: { name: "Malaysia", capital: "Kuala Lumpur" } },
    { code: "nz", tier: 1, ko: { name: "뉴질랜드", capital: "웰링턴" }, en: { name: "New Zealand", capital: "Wellington" } },

    { code: "pt", tier: 2, ko: { name: "포르투갈", capital: "리스본" }, en: { name: "Portugal", capital: "Lisbon" } },
    { code: "gr", tier: 2, ko: { name: "그리스", capital: "아테네" }, en: { name: "Greece", capital: "Athens" } },
    { code: "pl", tier: 2, ko: { name: "폴란드", capital: "바르샤바" }, en: { name: "Poland", capital: "Warsaw" } },
    { code: "ie", tier: 2, ko: { name: "아일랜드", capital: "더블린" }, en: { name: "Ireland", capital: "Dublin" } },
    { code: "be", tier: 2, ko: { name: "벨기에", capital: "브뤼셀" }, en: { name: "Belgium", capital: "Brussels" } },
    { code: "at", tier: 2, ko: { name: "오스트리아", capital: "빈" }, en: { name: "Austria", capital: "Vienna" } },
    { code: "no", tier: 2, ko: { name: "노르웨이", capital: "오슬로" }, en: { name: "Norway", capital: "Oslo" } },
    { code: "dk", tier: 2, ko: { name: "덴마크", capital: "코펜하겐" }, en: { name: "Denmark", capital: "Copenhagen" } },
    { code: "fi", tier: 2, ko: { name: "핀란드", capital: "헬싱키" }, en: { name: "Finland", capital: "Helsinki" } },
    { code: "cz", tier: 2, ko: { name: "체코", capital: "프라하" }, en: { name: "Czechia", capital: "Prague" } },
    { code: "hu", tier: 2, ko: { name: "헝가리", capital: "부다페스트" }, en: { name: "Hungary", capital: "Budapest" } },
    { code: "ro", tier: 2, ko: { name: "루마니아", capital: "부쿠레슈티" }, en: { name: "Romania", capital: "Bucharest" } },
    { code: "ua", tier: 2, ko: { name: "우크라이나", capital: "키이우" }, en: { name: "Ukraine", capital: "Kyiv" } },
    { code: "il", tier: 2, ko: { name: "이스라엘", capital: "예루살렘" }, en: { name: "Israel", capital: "Jerusalem" } },
    { code: "ae", tier: 2, ko: { name: "아랍에미리트", capital: "아부다비" }, en: { name: "United Arab Emirates", capital: "Abu Dhabi" } },
    { code: "qa", tier: 2, ko: { name: "카타르", capital: "도하" }, en: { name: "Qatar", capital: "Doha" } },
    { code: "kw", tier: 2, ko: { name: "쿠웨이트", capital: "쿠웨이트시티" }, en: { name: "Kuwait", capital: "Kuwait City" } },
    { code: "ir", tier: 2, ko: { name: "이란", capital: "테헤란" }, en: { name: "Iran", capital: "Tehran" } },
    { code: "iq", tier: 2, ko: { name: "이라크", capital: "바그다드" }, en: { name: "Iraq", capital: "Baghdad" } },
    { code: "pk", tier: 2, ko: { name: "파키스탄", capital: "이슬라마바드" }, en: { name: "Pakistan", capital: "Islamabad" } },
    { code: "bd", tier: 2, ko: { name: "방글라데시", capital: "다카" }, en: { name: "Bangladesh", capital: "Dhaka" } },
    { code: "lk", tier: 2, ko: { name: "스리랑카", capital: "스리자야와르데네푸라코테" }, en: { name: "Sri Lanka", capital: "Sri Jayawardenepura Kotte" } },
    { code: "np", tier: 2, ko: { name: "네팔", capital: "카트만두" }, en: { name: "Nepal", capital: "Kathmandu" } },
    { code: "mm", tier: 2, ko: { name: "미얀마", capital: "네피도" }, en: { name: "Myanmar", capital: "Naypyidaw" } },
    { code: "kh", tier: 2, ko: { name: "캄보디아", capital: "프놈펜" }, en: { name: "Cambodia", capital: "Phnom Penh" } },
    { code: "la", tier: 2, ko: { name: "라오스", capital: "비엔티안" }, en: { name: "Laos", capital: "Vientiane" } },
    { code: "mn", tier: 2, ko: { name: "몽골", capital: "울란바토르" }, en: { name: "Mongolia", capital: "Ulaanbaatar" } },
    { code: "tw", tier: 2, ko: { name: "대만", capital: "타이베이" }, en: { name: "Taiwan", capital: "Taipei" } },
    { code: "hk", tier: 2, ko: { name: "홍콩", capital: "홍콩" }, en: { name: "Hong Kong", capital: "Hong Kong" } },
    { code: "cl", tier: 2, ko: { name: "칠레", capital: "산티아고" }, en: { name: "Chile", capital: "Santiago" } },
    { code: "co", tier: 2, ko: { name: "콜롬비아", capital: "보고타" }, en: { name: "Colombia", capital: "Bogotá" } },
    { code: "pe", tier: 2, ko: { name: "페루", capital: "리마" }, en: { name: "Peru", capital: "Lima" } },
    { code: "ve", tier: 2, ko: { name: "베네수엘라", capital: "카라카스" }, en: { name: "Venezuela", capital: "Caracas" } },
    { code: "cu", tier: 2, ko: { name: "쿠바", capital: "아바나" }, en: { name: "Cuba", capital: "Havana" } },
    { code: "ng", tier: 2, ko: { name: "나이지리아", capital: "아부자" }, en: { name: "Nigeria", capital: "Abuja" } },
    { code: "ke", tier: 2, ko: { name: "케냐", capital: "나이로비" }, en: { name: "Kenya", capital: "Nairobi" } },
    { code: "ma", tier: 2, ko: { name: "모로코", capital: "라바트" }, en: { name: "Morocco", capital: "Rabat" } },
    { code: "dz", tier: 2, ko: { name: "알제리", capital: "알제" }, en: { name: "Algeria", capital: "Algiers" } },
    { code: "et", tier: 2, ko: { name: "에티오피아", capital: "아디스아바바" }, en: { name: "Ethiopia", capital: "Addis Ababa" } },

    { code: "is", tier: 3, ko: { name: "아이슬란드", capital: "레이캬비크" }, en: { name: "Iceland", capital: "Reykjavík" } },
    { code: "lu", tier: 3, ko: { name: "룩셈부르크", capital: "룩셈부르크" }, en: { name: "Luxembourg", capital: "Luxembourg" } },
    { code: "mt", tier: 3, ko: { name: "몰타", capital: "발레타" }, en: { name: "Malta", capital: "Valletta" } },
    { code: "cy", tier: 3, ko: { name: "키프로스", capital: "니코시아" }, en: { name: "Cyprus", capital: "Nicosia" } },
    { code: "hr", tier: 3, ko: { name: "크로아티아", capital: "자그레브" }, en: { name: "Croatia", capital: "Zagreb" } },
    { code: "rs", tier: 3, ko: { name: "세르비아", capital: "베오그라드" }, en: { name: "Serbia", capital: "Belgrade" } },
    { code: "bg", tier: 3, ko: { name: "불가리아", capital: "소피아" }, en: { name: "Bulgaria", capital: "Sofia" } },
    { code: "sk", tier: 3, ko: { name: "슬로바키아", capital: "브라티슬라바" }, en: { name: "Slovakia", capital: "Bratislava" } },
    { code: "si", tier: 3, ko: { name: "슬로베니아", capital: "류블랴나" }, en: { name: "Slovenia", capital: "Ljubljana" } },
    { code: "ee", tier: 3, ko: { name: "에스토니아", capital: "탈린" }, en: { name: "Estonia", capital: "Tallinn" } },
    { code: "lv", tier: 3, ko: { name: "라트비아", capital: "리가" }, en: { name: "Latvia", capital: "Riga" } },
    { code: "lt", tier: 3, ko: { name: "리투아니아", capital: "빌뉴스" }, en: { name: "Lithuania", capital: "Vilnius" } },
    { code: "by", tier: 3, ko: { name: "벨라루스", capital: "민스크" }, en: { name: "Belarus", capital: "Minsk" } },
    { code: "ge", tier: 3, ko: { name: "조지아", capital: "트빌리시" }, en: { name: "Georgia", capital: "Tbilisi" } },
    { code: "am", tier: 3, ko: { name: "아르메니아", capital: "예레반" }, en: { name: "Armenia", capital: "Yerevan" } },
    { code: "az", tier: 3, ko: { name: "아제르바이잔", capital: "바쿠" }, en: { name: "Azerbaijan", capital: "Baku" } },
    { code: "kz", tier: 3, ko: { name: "카자흐스탄", capital: "아스타나" }, en: { name: "Kazakhstan", capital: "Astana" } },
    { code: "uz", tier: 3, ko: { name: "우즈베키스탄", capital: "타슈켄트" }, en: { name: "Uzbekistan", capital: "Tashkent" } },
    { code: "jo", tier: 3, ko: { name: "요르단", capital: "암만" }, en: { name: "Jordan", capital: "Amman" } },
    { code: "lb", tier: 3, ko: { name: "레바논", capital: "베이루트" }, en: { name: "Lebanon", capital: "Beirut" } },
    { code: "om", tier: 3, ko: { name: "오만", capital: "무스카트" }, en: { name: "Oman", capital: "Muscat" } },
    { code: "bh", tier: 3, ko: { name: "바레인", capital: "마나마" }, en: { name: "Bahrain", capital: "Manama" } },
    { code: "af", tier: 3, ko: { name: "아프가니스탄", capital: "카불" }, en: { name: "Afghanistan", capital: "Kabul" } },
    { code: "bn", tier: 3, ko: { name: "브루나이", capital: "반다르스리브가완" }, en: { name: "Brunei", capital: "Bandar Seri Begawan" } },
    { code: "fj", tier: 3, ko: { name: "피지", capital: "수바" }, en: { name: "Fiji", capital: "Suva" } },
    { code: "pg", tier: 3, ko: { name: "파푸아뉴기니", capital: "포트모르즈비" }, en: { name: "Papua New Guinea", capital: "Port Moresby" } },
    { code: "uy", tier: 3, ko: { name: "우루과이", capital: "몬테비데오" }, en: { name: "Uruguay", capital: "Montevideo" } },
    { code: "py", tier: 3, ko: { name: "파라과이", capital: "아순시온" }, en: { name: "Paraguay", capital: "Asunción" } },
    { code: "bo", tier: 3, ko: { name: "볼리비아", capital: "수크레" }, en: { name: "Bolivia", capital: "Sucre" } },
    { code: "ec", tier: 3, ko: { name: "에콰도르", capital: "키토" }, en: { name: "Ecuador", capital: "Quito" } },
    { code: "cr", tier: 3, ko: { name: "코스타리카", capital: "산호세" }, en: { name: "Costa Rica", capital: "San José" } },
    { code: "pa", tier: 3, ko: { name: "파나마", capital: "파나마시티" }, en: { name: "Panama", capital: "Panama City" } },
    { code: "gt", tier: 3, ko: { name: "과테말라", capital: "과테말라시티" }, en: { name: "Guatemala", capital: "Guatemala City" } },
    { code: "do", tier: 3, ko: { name: "도미니카공화국", capital: "산토도밍고" }, en: { name: "Dominican Republic", capital: "Santo Domingo" } },
    { code: "jm", tier: 3, ko: { name: "자메이카", capital: "킹스턴" }, en: { name: "Jamaica", capital: "Kingston" } },
    { code: "tn", tier: 3, ko: { name: "튀니지", capital: "튀니스" }, en: { name: "Tunisia", capital: "Tunis" } },
    { code: "gh", tier: 3, ko: { name: "가나", capital: "아크라" }, en: { name: "Ghana", capital: "Accra" } },
    { code: "sn", tier: 3, ko: { name: "세네갈", capital: "다카르" }, en: { name: "Senegal", capital: "Dakar" } },
    { code: "tz", tier: 3, ko: { name: "탄자니아", capital: "도도마" }, en: { name: "Tanzania", capital: "Dodoma" } },
    { code: "ug", tier: 3, ko: { name: "우간다", capital: "캄팔라" }, en: { name: "Uganda", capital: "Kampala" } },
    { code: "zw", tier: 3, ko: { name: "짐바브웨", capital: "하라레" }, en: { name: "Zimbabwe", capital: "Harare" } },
    { code: "ao", tier: 3, ko: { name: "앙골라", capital: "루안다" }, en: { name: "Angola", capital: "Luanda" } },
    { code: "mg", tier: 3, ko: { name: "마다가스카르", capital: "안타나나리보" }, en: { name: "Madagascar", capital: "Antananarivo" } },
    { code: "mu", tier: 3, ko: { name: "모리셔스", capital: "포트루이스" }, en: { name: "Mauritius", capital: "Port Louis" } },
    { code: "mv", tier: 3, ko: { name: "몰디브", capital: "말레" }, en: { name: "Maldives", capital: "Malé" } },
    { code: "bt", tier: 3, ko: { name: "부탄", capital: "팀푸" }, en: { name: "Bhutan", capital: "Thimphu" } },
    { code: "mo", tier: 3, ko: { name: "마카오", capital: "마카오" }, en: { name: "Macao", capital: "Macao" } }
  ];

  var BEST_KEY = "webtoolbay-flag-best";
  var MAX_LIVES = 3;

  var els = {};
  var state = {
    playing: false,
    answered: false,
    lives: MAX_LIVES,
    streak: 0,
    score: 0,
    best: 0,
    current: null,
    choices: [],
    recentCodes: []
  };

  function tt(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function langBucket() {
    var lang = typeof window.getLang === "function" ? window.getLang() : "ko";
    return lang === "ko" ? "ko" : "en";
  }

  function labelOf(country) {
    var bucket = langBucket();
    return (country[bucket] || country.en).name;
  }

  function capitalOf(country) {
    var bucket = langBucket();
    return (country[bucket] || country.en).capital;
  }

  function flagUrl(code) {
    return "https://flagcdn.com/w320/" + code + ".png";
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function maxTierForStreak(streak) {
    if (streak >= 12) return 3;
    if (streak >= 5) return 2;
    return 1;
  }

  function pickAnswer() {
    var maxTier = maxTierForStreak(state.streak);
    var pool = COUNTRIES.filter(function (c) {
      return c.tier <= maxTier && state.recentCodes.indexOf(c.code) === -1;
    });
    if (pool.length < 8) {
      pool = COUNTRIES.filter(function (c) { return c.tier <= maxTier; });
    }
    if (!pool.length) pool = COUNTRIES.slice();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickChoices(answer) {
    var sameTier = COUNTRIES.filter(function (c) {
      return c.code !== answer.code && Math.abs(c.tier - answer.tier) <= 1;
    });
    if (sameTier.length < 3) {
      sameTier = COUNTRIES.filter(function (c) { return c.code !== answer.code; });
    }
    var distractors = shuffle(sameTier).slice(0, 3);
    return shuffle([answer].concat(distractors));
  }

  function loadBest() {
    try {
      var n = Number(localStorage.getItem(BEST_KEY) || 0);
      state.best = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (e) {
      state.best = 0;
    }
  }

  function saveBest() {
    if (state.score > state.best) {
      state.best = state.score;
      try {
        localStorage.setItem(BEST_KEY, String(state.best));
      } catch (e) {}
    }
  }

  function renderHud() {
    if (els.streak) els.streak.textContent = String(state.streak);
    if (els.score) els.score.textContent = String(state.score);
    if (els.best) els.best.textContent = String(state.best);
    if (els.lives) {
      var hearts = "";
      for (var i = 0; i < MAX_LIVES; i++) {
        hearts += i < state.lives ? "❤️" : "🖤";
      }
      els.lives.textContent = hearts;
      els.lives.setAttribute("aria-label", tt("flag.livesAria", { n: state.lives }));
    }
  }

  function setIdle() {
    state.playing = false;
    state.answered = false;
    state.current = null;
    state.choices = [];
    if (els.playArea) els.playArea.hidden = true;
    if (els.idle) els.idle.hidden = false;
    if (els.feedback) {
      els.feedback.hidden = true;
      els.feedback.className = "flag-feedback";
      els.feedback.textContent = "";
    }
    if (els.nextBtn) els.nextBtn.hidden = true;
    if (els.restartBtn) els.restartBtn.hidden = true;
    renderHud();
  }

  function startGame() {
    state.playing = true;
    state.answered = false;
    state.lives = MAX_LIVES;
    state.streak = 0;
    state.score = 0;
    state.recentCodes = [];
    if (els.idle) els.idle.hidden = true;
    if (els.playArea) els.playArea.hidden = false;
    if (els.restartBtn) els.restartBtn.hidden = false;
    nextRound();
  }

  function gameOver() {
    state.playing = false;
    saveBest();
    renderHud();
    if (els.feedback) {
      els.feedback.hidden = false;
      els.feedback.className = "flag-feedback is-over";
      els.feedback.innerHTML =
        "<strong>" +
        escapeHtml(tt("flag.gameOver")) +
        "</strong><span>" +
        escapeHtml(tt("flag.gameOverDetail", { score: state.score, best: state.best })) +
        "</span>";
    }
    if (els.nextBtn) els.nextBtn.hidden = true;
    if (els.choices) {
      Array.prototype.forEach.call(els.choices.querySelectorAll("button"), function (btn) {
        btn.disabled = true;
      });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nextRound() {
    if (!state.playing) return;
    state.answered = false;
    var answer = pickAnswer();
    state.current = answer;
    state.choices = pickChoices(answer);
    state.recentCodes.push(answer.code);
    if (state.recentCodes.length > 12) state.recentCodes.shift();

    if (els.flagImg) {
      els.flagImg.alt = tt("flag.flagAlt");
      els.flagImg.src = flagUrl(answer.code);
      els.flagImg.srcset =
        "https://flagcdn.com/w160/" +
        answer.code +
        ".png 160w, https://flagcdn.com/w320/" +
        answer.code +
        ".png 320w, https://flagcdn.com/w640/" +
        answer.code +
        ".png 640w";
    }
    if (els.feedback) {
      els.feedback.hidden = true;
      els.feedback.className = "flag-feedback";
      els.feedback.textContent = "";
    }
    if (els.nextBtn) els.nextBtn.hidden = true;
    renderChoices();
    renderHud();
  }

  function renderChoices() {
    if (!els.choices) return;
    els.choices.innerHTML = "";
    state.choices.forEach(function (country) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flag-choice";
      btn.textContent = labelOf(country);
      btn.dataset.code = country.code;
      btn.addEventListener("click", function () {
        onPick(country.code, btn);
      });
      els.choices.appendChild(btn);
    });
  }

  function onPick(code, btn) {
    if (!state.playing || state.answered || !state.current) return;
    state.answered = true;
    var correct = code === state.current.code;
    var buttons = els.choices.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) {
      b.disabled = true;
      if (b.dataset.code === state.current.code) b.classList.add("is-correct");
      if (b === btn && !correct) b.classList.add("is-wrong");
    });

    if (correct) {
      state.streak += 1;
      state.score += 10 + Math.min(state.streak, 20);
      saveBest();
      if (els.feedback) {
        els.feedback.hidden = false;
        els.feedback.className = "flag-feedback is-correct";
        els.feedback.innerHTML =
          "<strong>" +
          escapeHtml(tt("flag.correct")) +
          "</strong><span>" +
          escapeHtml(
            tt("flag.capitalLine", {
              country: labelOf(state.current),
              capital: capitalOf(state.current)
            })
          ) +
          "</span>";
      }
      if (els.nextBtn) {
        els.nextBtn.hidden = false;
        els.nextBtn.focus();
      }
    } else {
      state.lives -= 1;
      state.streak = 0;
      if (els.feedback) {
        els.feedback.hidden = false;
        els.feedback.className = "flag-feedback is-wrong";
        els.feedback.innerHTML =
          "<strong>" +
          escapeHtml(tt("flag.wrong")) +
          "</strong><span>" +
          escapeHtml(
            tt("flag.answerLine", {
              country: labelOf(state.current),
              capital: capitalOf(state.current)
            })
          ) +
          "</span>";
      }
      if (state.lives <= 0) {
        gameOver();
      } else if (els.nextBtn) {
        els.nextBtn.hidden = false;
        els.nextBtn.focus();
      }
    }
    renderHud();
  }

  function cacheEls() {
    els.view = document.getElementById("flagView");
    els.idle = document.getElementById("flagIdle");
    els.playArea = document.getElementById("flagPlayArea");
    els.startBtn = document.getElementById("flagStartBtn");
    els.nextBtn = document.getElementById("flagNextBtn");
    els.restartBtn = document.getElementById("flagRestartBtn");
    els.flagImg = document.getElementById("flagImage");
    els.choices = document.getElementById("flagChoices");
    els.feedback = document.getElementById("flagFeedback");
    els.streak = document.getElementById("flagStreakHud");
    els.score = document.getElementById("flagScoreHud");
    els.best = document.getElementById("flagBestHud");
    els.lives = document.getElementById("flagLivesHud");
  }

  function bind() {
    if (!els.view) return;
    if (els.startBtn) els.startBtn.addEventListener("click", startGame);
    if (els.nextBtn) {
      els.nextBtn.addEventListener("click", function () {
        if (state.lives <= 0) {
          startGame();
        } else {
          nextRound();
        }
      });
    }
    if (els.restartBtn) {
      els.restartBtn.addEventListener("click", function () {
        startGame();
      });
    }
  }

  function refreshI18n() {
    if (!els.view || els.view.hidden) return;
    if (state.playing && state.current && !state.answered) {
      renderChoices();
    } else if (state.playing && state.current && state.answered) {
      // Keep choice button labels in sync after language switch mid-round.
      var buttons = els.choices ? els.choices.querySelectorAll("button") : [];
      Array.prototype.forEach.call(buttons, function (b) {
        var found = COUNTRIES.filter(function (c) { return c.code === b.dataset.code; })[0];
        if (found) b.textContent = labelOf(found);
      });
      if (els.feedback && !els.feedback.hidden && state.current) {
        var correctPick = els.choices && els.choices.querySelector(".is-correct.is-wrong") === null;
        var wasCorrect = els.feedback.classList.contains("is-correct");
        if (els.feedback.classList.contains("is-over")) {
          els.feedback.innerHTML =
            "<strong>" +
            escapeHtml(tt("flag.gameOver")) +
            "</strong><span>" +
            escapeHtml(tt("flag.gameOverDetail", { score: state.score, best: state.best })) +
            "</span>";
        } else if (wasCorrect) {
          els.feedback.innerHTML =
            "<strong>" +
            escapeHtml(tt("flag.correct")) +
            "</strong><span>" +
            escapeHtml(
              tt("flag.capitalLine", {
                country: labelOf(state.current),
                capital: capitalOf(state.current)
              })
            ) +
            "</span>";
        } else {
          els.feedback.innerHTML =
            "<strong>" +
            escapeHtml(tt("flag.wrong")) +
            "</strong><span>" +
            escapeHtml(
              tt("flag.answerLine", {
                country: labelOf(state.current),
                capital: capitalOf(state.current)
              })
            ) +
            "</span>";
        }
        void correctPick;
      }
    }
    renderHud();
  }

  function init() {
    cacheEls();
    if (!els.view) return;
    loadBest();
    setIdle();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.refreshFlagI18n = refreshI18n;
})();
