/**
 * Google Sheets 題庫設定區
 *
 * 請先將 Google 試算表「發布為網頁」，再把下方網址替換成實際的 CSV 發佈網址。
 * 可直接使用的網址格式範例：
 * https://docs.google.com/spreadsheets/d/試算表ID/gviz/tq?tqx=out:csv&sheet=工作表1
 */
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5jHIW93ATPvgnaLpzkXuzDVcJlsyxhayTNYllFI0QCwM6uPkE7PNbwTsSDDQi2gBwx_SyTIRafz4a/pub?gid=1525798700&single=true&output=csv";

// 宣告 Google Sheets CSV 必須具備的欄位名稱。
const REQUIRED_CSV_HEADERS = [
  "id",
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "answerIndex"
];

// 宣告測驗介面使用的字型堆疊；Google Fonts 連結由 index.html 載入。
const CANVAS_FONT_STACK = '"LXGW WenKai Mono TC", "Isometra", sans-serif';

// 宣告畫布背景顏色。
const BACKGROUND_COLOR = "#e0e1dd";

// 宣告答對選項的背景顏色。
const CORRECT_COLOR = "#99d98c";

// 宣告答錯選項的背景顏色。
const WRONG_COLOR = "#ff477e";

// 宣告正確答案提示的背景顏色。
const ANSWER_COLOR = "#a9def9";

// 宣告題目背景方框的填滿顏色。
const QUESTION_BOX_COLOR = "#cb997e";

// 宣告主要文字顏色。
const TEXT_COLOR = "#1d3557";

// 宣告按鈕的背景顏色。
const BUTTON_COLOR = "#457b9d";

// 宣告目前顯示的畫面狀態。
let screenState = "loading";

// 宣告目前顯示的題目索引。
let currentQuestionIndex = 0;

// 宣告使用者目前選取的選項索引。
let selectedIndex = -1;

// 宣告使用者答對的題數。
let correctCount = 0;

// 宣告目前題目是否已經作答。
let answered = false;

// 宣告下一題按鈕的版面資料。
let nextButton = {};

// 宣告重新測驗按鈕的版面資料。
let restartButton = {};

// 宣告觸控後暫時忽略滑鼠事件的時間。
let ignoreMouseUntil = 0;

// 宣告目前結果頁使用的特效類型。
let resultEffectType = "none";

// 宣告煙火升空中的火箭資料陣列。
let fireworkRockets = [];

// 宣告煙火爆炸後的彩色粒子資料陣列。
let fireworkParticles = [];

// 宣告煙火特效的產生計時器。
let fireworkSpawnTimer = 0;

// 宣告從 Google Sheets CSV 載入的完整有效題庫。
let questionBank = [];

// 宣告本次測驗隨機抽出的五題。
let questions = [];

// 宣告題庫載入狀態。
let questionDataState = "loading";

// 宣告題庫載入失敗時顯示的錯誤訊息。
let loadErrorMessage = "";

// 宣告每次測驗要抽出的題目數量。
const QUIZ_QUESTION_COUNT = 5;

// 將 p5.js 文字大小與 Canvas 字型堆疊同步設定。
function setCanvasFont(fontSize) {
  // 先使用 p5.js API 設定文字大小。
  textSize(fontSize);

  // 直接設定 Canvas 文字堆疊，避免 p5.js textFont() 解析 CSS 多字型字串時發生錯誤。
  if (typeof drawingContext !== "undefined" && drawingContext) {
    drawingContext.font = `${fontSize}px ${CANVAS_FONT_STACK}`;
  }
}

// 將錯誤訊息同步到隱藏的 HTML 容器，主要錯誤畫面仍由 Canvas 顯示。
function setLoadError(message) {
  // 設定資料狀態為錯誤，讓互動函式在載入失敗時全部停止。
  questionDataState = "error";

  // 將畫面狀態切換到錯誤頁。
  screenState = "error";

  // 保存完整錯誤訊息供 Canvas 換行顯示。
  loadErrorMessage = message;

  // 若 HTML 中存在錯誤提示容器，就同步更新其文字內容。
  const errorElement = document.getElementById("error-message");
  if (errorElement) {
    errorElement.textContent = message;
  }
}

// 解析 CSV 文字，支援雙引號欄位、欄位內逗號、欄位內換行與連續雙引號。
function parseCSV(csvText) {
  // 將輸入轉換成文字，並移除 UTF-8 BOM，避免第一個欄位名稱比對失敗。
  const text = String(csvText || "").replace(/^\uFEFF/, "");

  // 建立 CSV 解析結果、目前資料列與目前欄位的暫存資料。
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  // 逐字元掃描 CSV，不能使用簡單的 split(',')。
  for (let index = 0; index < text.length; index++) {
    // 取得目前正在解析的字元。
    const character = text[index];

    // 在雙引號欄位中，連續兩個雙引號代表一個實際雙引號。
    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    // 在未包覆雙引號時，逗號才是欄位分隔符號。
    if (character === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    // 在未包覆雙引號時，換行才是資料列分隔符號。
    if ((character === "\n" || character === "\r") && !insideQuotes) {
      // 處理 Windows 的 CRLF，避免產生多出的空白資料列。
      if (character === "\r" && text[index + 1] === "\n") {
        index++;
      }

      // 將目前欄位與資料列保存起來。
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    // 雙引號內的逗號或換行會保留在欄位文字中。
    field += character;
  }

  // 保存檔案末尾尚未遇到換行符號的最後一筆資料。
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 沒有標題列時回傳空的解析結果。
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  // 清除標題欄位的 BOM 與前後空白，符合 Google Sheets 欄位標題要求。
  const headers = rows[0].map((header) => String(header || "").replace(/^\uFEFF/, "").trim());

  // 將每一列轉換為以欄位標題為鍵的物件，保留欄位內逗號與換行。
  const records = rows.slice(1)
    .filter((values) => values.some((value) => String(value || "").trim().length > 0))
    .map((values) => {
      const record = {};
      headers.forEach((header, columnIndex) => {
        record[header] = values[columnIndex] === undefined ? "" : values[columnIndex];
      });
      return record;
    });

  // 同時回傳清理後標題與資料列，讓後續驗證不必重複解析 CSV。
  return { headers, records };
}

// 驗證 CSV 欄位名稱，並將每列轉為有效的測驗題目。
function buildQuestionBank(csvText) {
  // 先用穩定的 CSV 解析器取得清理後欄位標題與所有資料列。
  const parsedCSV = parseCSV(csvText);
  const records = parsedCSV.records;
  const headers = parsedCSV.headers;

  // 檢查清理後的必要欄位是否全部存在。
  const missingHeaders = REQUIRED_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 缺少必要欄位：${missingHeaders.join(", ")}`);
  }

  // 逐列驗證題目、四個選項與正確答案索引。
  const validQuestions = [];
  for (const record of records) {
    // 讀取並清除題目與選項欄位的前後空白。
    const id = String(record.id || "").trim();
    const questionText = String(record.question || "").trim();
    const options = [
      String(record.optionA || "").trim(),
      String(record.optionB || "").trim(),
      String(record.optionC || "").trim(),
      String(record.optionD || "").trim()
    ];

    // 只接受整數 0、1、2、3 作為正確答案索引。
    const answerText = String(record.answerIndex || "").trim();
    const answerIndex = Number(answerText);
    const validAnswer = Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex <= 3;

    // 題目與四個選項不可為空，無效列直接忽略。
    const validRow = questionText.length > 0 && options.every((option) => option.length > 0) && validAnswer;
    if (validRow) {
      validQuestions.push({ id, question: questionText, options, answerIndex });
    }
  }

  // 回傳完整有效題庫；有效題目不足五題由載入函式統一顯示錯誤頁。
  return validQuestions;
}

// 從 Google Sheets 發佈的 CSV 直接載入題庫。
async function loadGoogleSheetQuestions() {
  // 檢查老師是否已替換設定區中的佔位網址。
  if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.includes("請將Google Sheets")) {
    setLoadError(
      "尚未設定 Google Sheets CSV 網址。請將實際網址貼到 GOOGLE_SHEET_CSV_URL，並確認試算表已發布為網頁、CSV網址正確、題庫欄位正確，以及需要透過 HTTP/HTTPS 或 p5.js Web Editor 開啟，而不是直接用 file://。"
    );
    return;
  }

  try {
    // 加入時間戳記，避免 Google Sheets CSV 被瀏覽器或代理伺服器快取。
    const requestUrl = `${GOOGLE_SHEET_CSV_URL}${GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;

    // 直接以 fetch 讀取遠端 CSV，並關閉瀏覽器快取。
    const response = await fetch(requestUrl, { cache: "no-store" });

    // 非 2xx 回應視為載入失敗，讓錯誤頁顯示清楚的 HTTP 狀態。
    if (!response.ok) {
      throw new Error(`Google Sheets 回應失敗（HTTP ${response.status}）。`);
    }

    // 讀取完整 CSV 文字，交由穩定解析器處理。
    const csvText = await response.text();

    // 驗證欄位並建立有效題庫，無效資料列會被忽略。
    const validQuestions = buildQuestionBank(csvText);

    // 有效題目少於五題時無法完成指定測驗，顯示錯誤頁。
    if (validQuestions.length < QUIZ_QUESTION_COUNT) {
      throw new Error(`目前只有 ${validQuestions.length} 題有效題目，至少需要 ${QUIZ_QUESTION_COUNT} 題。`);
    }

    // 將有效題目保存到完整題庫 questionBank。
    questionBank = validQuestions;

    // 標記題庫已載入完成，重新測驗時可直接使用，不必再次網路載入。
    questionDataState = "ready";

    // 每次網站成功載入後立即洗牌並抽出五題。
    startNewQuiz();
  } catch (error) {
    // 將網路、CORS、欄位或資料格式錯誤轉成完整的使用者提示。
    setLoadError(
      `題庫載入失敗：${error.message || "無法讀取 Google Sheets CSV。"}\n\n請確認：\n1. 試算表已「發布為網頁」且可查看。\n2. GOOGLE_SHEET_CSV_URL 是正確的 CSV 網址。\n3. 第一列欄位包含 id、question、optionA、optionB、optionC、optionD、answerIndex。\n4. 有效題目至少有 5 題，且四個選項不為空、answerIndex 為 0 至 3。\n5. 網頁是透過 HTTP/HTTPS 或 p5.js Web Editor 開啟，不是直接用 file://。若仍失敗，可能是遠端跨來源（CORS）限制。`
    );
  }
}

// 從完整題庫複製並洗牌後抽出本次測驗的五題。
function startNewQuiz() {
  // 題庫尚未準備好時不允許開始測驗。
  if (questionDataState !== "ready" || questionBank.length < QUIZ_QUESTION_COUNT) {
    // 將錯誤狀態交由 draw 顯示，避免產生不完整測驗。
    questionDataState = "error";
    loadErrorMessage = "題庫載入失敗，請確認 Google Sheets 已發布為網頁、CSV網址正確、欄位正確，並透過 HTTP/HTTPS 或 p5.js Web Editor 開啟。";
    return;
  }

  // 複製題庫後再洗牌，確保不改變 questionBank 原始順序。
  const shuffledQuestions = shuffle(questionBank.slice());

  // 取洗牌後前五題作為本輪測驗題目。
  questions = shuffledQuestions.slice(0, QUIZ_QUESTION_COUNT);

  // 重設本輪測驗的目前題目索引。
  currentQuestionIndex = 0;

  // 重設使用者選取的選項。
  selectedIndex = -1;

  // 重設答題狀態。
  answered = false;

  // 重設答對題數。
  correctCount = 0;

  // 清除上一輪結果頁的特效資料。
  resetResultEffects();

  // 將畫面狀態切換到 quiz 測驗頁。
  screenState = "quiz";
}

// 繪製題庫載入中的畫面。
function drawLoadingScreen() {
  // 設定提示文字顏色與字型大小。
  fill(TEXT_COLOR);
  noStroke();
  setCanvasFont(constrain(min(width, height) * 0.06, 18, 32));

  // 顯示題庫載入提示。
  text("正在載入 Google 試算表題庫...", width / 2, height / 2);
}

// 繪製題庫載入失敗或資料不足的錯誤畫面。
function drawErrorScreen() {
  // 設定錯誤提示文字的繪圖樣式。
  fill(TEXT_COLOR);
  noStroke();

  // 依照畫布大小設定標題字型。
  setCanvasFont(constrain(min(width, height) * 0.055, 17, 30));
  text("題庫載入失敗", width / 2, height * 0.38);

  // 使用換行函式顯示完整的錯誤原因與處理方式。
  setCanvasFont(constrain(min(width, height) * 0.035, 13, 20));
  drawWrappedText(
    loadErrorMessage || "請確認 Google Sheets 已發布為網頁、CSV網址正確、欄位正確，並透過 HTTP/HTTPS 或 p5.js Web Editor 開啟。",
    width / 2,
    height * 0.55,
    min(width * 0.86, 720),
    constrain(min(width, height) * 0.05, 22, 34),
    constrain(min(width, height) * 0.035, 13, 20)
  );
}

// 建立 p5.js 畫布並設定基本繪圖環境。
function setup() {
  // 建立符合瀏覽器視窗大小的全螢幕畫布。
  createCanvas(windowWidth, windowHeight);

  // 將文字水平與垂直對齊方式設定為置中。
  textAlign(CENTER, CENTER);

  // 將矩形的定位方式設定為左上角。
  rectMode(CORNER);

  // 使用 index.html 載入的中文主字型。
  textFont("LXGW WenKai Mono TC");

  // 先套用字型堆疊，讓 Canvas 中的中文、英文與數字使用指定回退順序。
  setCanvasFont(16);

  // 讓動畫以穩定的畫面更新速度執行。
  frameRate(60);

  // 載入期間先顯示 loading 狀態，完成後由 fetch 函式切換到 quiz。
  screenState = "loading";
  questionDataState = "loading";

  // 直接從 Google Sheets 發佈的 CSV 讀取遠端題庫。
  loadGoogleSheetQuestions();
}

// p5.js 每一幀都會執行的主要繪圖函式。
function draw() {
  // 使用指定畫布背景色清除整個畫面。
  background(BACKGROUND_COLOR);

  // 依照 loading、error、quiz、result 四種狀態繪製對應畫面。
  if (screenState === "loading") {
    // 題庫載入期間只顯示等待提示並禁止互動。
    drawLoadingScreen();
  } else if (screenState === "error") {
    // 題庫載入失敗或資料不足時顯示完整錯誤說明。
    drawErrorScreen();
  } else if (screenState === "quiz") {
    // 題庫準備完成後繪製五題四選一測驗。
    drawQuizScreen();
  } else if (screenState === "result") {
    // 五題完成後繪製分數、訊息與結果特效。
    drawResultScreen();
  }
}

// 繪製測驗頁面的標題、題目、選項與按鈕。
function drawQuizScreen() {
  // 題目不足時改顯示錯誤畫面，避免存取不存在的題目資料。
  if (questions.length < QUIZ_QUESTION_COUNT || !questions[currentQuestionIndex]) {
    // 設定錯誤狀態並繪製錯誤訊息。
    questionDataState = "error";
    loadErrorMessage = "題庫載入失敗，請確認 Google Sheets 已發布為網頁、CSV網址正確、欄位正確，並透過 HTTP/HTTPS 或 p5.js Web Editor 開啟。";
    drawErrorScreen();
    return;
  }

  // 取得目前題目的資料。
  const currentQuestion = questions[currentQuestionIndex];

  // 取得依照目前畫布大小計算出的響應式版面。
  const layout = getLayout();

  // 設定標題文字顏色。
  fill(TEXT_COLOR);

  // 移除標題文字的外框。
  noStroke();

  // 設定標題文字大小。
  setCanvasFont(layout.titleSize);

  // 繪製可換行的測驗標題，避免窄畫面被裁切。
  drawWrappedText(
    "程式設計簡易指令練習測驗",
    width / 2,
    layout.titleY,
    layout.contentWidth,
    layout.titleLineHeight,
    layout.titleSize
  );

  // 設定題數提示文字大小。
  setCanvasFont(layout.infoSize);

  // 顯示目前題數與總題數。
  text(
    `第 ${currentQuestionIndex + 1} 題／共 ${questions.length} 題`,
    width / 2,
    layout.infoY
  );

  // 設定題目背景方框的填滿顏色。
  fill(QUESTION_BOX_COLOR);

  // 設定題目方框的外框顏色。
  stroke(TEXT_COLOR);

  // 設定題目方框的外框粗細。
  strokeWeight(2);

  // 繪製會隨畫面大小改變的題目背景方框。
  rect(
    layout.questionBox.x,
    layout.questionBox.y,
    layout.questionBox.w,
    layout.questionBox.h,
    layout.cornerRadius
  );

  // 設定題目文字顏色。
  fill(TEXT_COLOR);

  // 移除題目文字外框。
  noStroke();

  // 設定題目文字大小。
  setCanvasFont(layout.questionSize);

  // 將過長題目依照方框寬度自動換行。
  drawWrappedText(
    currentQuestion.question,
    layout.questionBox.x + layout.questionBox.w / 2,
    layout.questionBox.y + layout.questionBox.h / 2,
    layout.questionBox.w - layout.questionPadding * 2,
    layout.questionLineHeight,
    layout.questionSize
  );

  // 逐一繪製目前題目的四個選項。
  for (let i = 0; i < currentQuestion.options.length; i++) {
    // 傳入選項索引、文字與目前版面資料。
    drawOption(i, currentQuestion.options[i], layout);
  }

  // 只有完成作答後才顯示下一題按鈕。
  if (answered) {
    // 繪製下一題或查看結果按鈕。
    drawNextButton(layout);
  } else {
    // 尚未作答時清除舊的按鈕範圍，避免尺寸改變後誤觸。
    nextButton = {};
  }
}

// 繪製單一選項，並保留答題動畫效果。
function drawOption(index, optionText, layout) {
  // 取得目前選項的響應式矩形資料。
  const optionBox = layout.options[index];

  // 宣告選項的水平動畫位移量。
  let offsetX = 0;

  // 宣告選項的垂直動畫位移量。
  let offsetY = 0;

  // 設定尚未作答時的選項背景色。
  let optionColor = color(255, 255, 255, 220);

  // 作答完成後才顯示不同的答題結果顏色與動畫。
  if (answered) {
    // 取得本題正確答案的索引。
    const correctAnswerIndex = questions[currentQuestionIndex].answerIndex;

    // 判斷使用者是否答對。
    if (selectedIndex === correctAnswerIndex) {
      // 只將答對的選項標示為綠色。
      if (index === selectedIndex) {
        // 設定答對選項的背景色。
        optionColor = color(CORRECT_COLOR);

        // 讓答對選項上下跳動。
        offsetY = sin(frameCount * 0.16) * layout.animationDistance;
      }
    } else {
      // 將使用者選錯的選項標示為粉紅色。
      if (index === selectedIndex) {
        // 設定答錯選項的背景色。
        optionColor = color(WRONG_COLOR);

        // 讓答錯選項左右移動。
        offsetX = sin(frameCount * 0.25) * layout.animationDistance;
      }

      // 將正確答案選項標示為藍色。
      if (index === correctAnswerIndex) {
        // 設定正確答案提示的背景色。
        optionColor = color(ANSWER_COLOR);

        // 讓正確答案選項上下跳動。
        offsetY = sin(frameCount * 0.16) * layout.animationDistance;
      }
    }
  }

  // 將動畫位移限制在畫布範圍內，避免選項超出畫布。
  offsetX = constrain(
    offsetX,
    -optionBox.x,
    width - optionBox.x - optionBox.w
  );

  // 將垂直動畫位移限制在畫布範圍內，避免選項超出畫布。
  offsetY = constrain(
    offsetY,
    -optionBox.y,
    height - optionBox.y - optionBox.h
  );

  // 儲存目前的繪圖狀態，讓位移不影響其他元件。
  push();

  // 套用安全的動畫位移。
  translate(offsetX, offsetY);

  // 設定選項的填滿顏色。
  fill(optionColor);

  // 設定選項外框顏色。
  stroke(TEXT_COLOR);

  // 設定選項外框粗細。
  strokeWeight(2);

  // 繪製響應式圓角選項方框。
  rect(optionBox.x, optionBox.y, optionBox.w, optionBox.h, layout.cornerRadius);

  // 設定選項文字顏色。
  fill(TEXT_COLOR);

  // 移除選項文字外框。
  noStroke();

  // 設定選項文字大小。
  setCanvasFont(layout.optionSize);

  // 繪製可換行的選項文字，避免文字超出選項方框。
  drawWrappedText(
    `${String.fromCharCode(65 + index)}. ${optionText}`,
    optionBox.x + optionBox.w / 2,
    optionBox.y + optionBox.h / 2,
    optionBox.w - layout.optionPadding * 2,
    layout.optionLineHeight,
    layout.optionSize
  );

  // 還原進入本函式前的繪圖狀態。
  pop();
}

// 繪製下一題或查看結果按鈕。
function drawNextButton(layout) {
  // 將按鈕版面資料儲存起來，供滑鼠與觸控事件判斷。
  nextButton = layout.nextButton;

  // 設定按鈕填滿顏色。
  fill(BUTTON_COLOR);

  // 設定按鈕外框顏色。
  stroke(TEXT_COLOR);

  // 設定按鈕外框粗細。
  strokeWeight(2);

  // 繪製不會超出畫布的圓角按鈕。
  rect(
    nextButton.x,
    nextButton.y,
    nextButton.w,
    nextButton.h,
    layout.cornerRadius
  );

  // 設定按鈕文字顏色。
  fill("#ffffff");

  // 移除按鈕文字外框。
  noStroke();

  // 設定按鈕文字大小。
  setCanvasFont(layout.buttonTextSize);

  // 依照是否為最後一題決定按鈕文字。
  const buttonLabel =
    currentQuestionIndex === questions.length - 1 ? "查看結果" : "答下一題";

  // 顯示按鈕文字。
  text(buttonLabel, nextButton.x + nextButton.w / 2, nextButton.y + nextButton.h / 2);
}

// 繪製測驗完成後的結果頁面。
function drawResultScreen() {
  // 取得依照目前畫布大小計算出的結果頁版面。
  const layout = getResultLayout();

  // 計算每題二十分的總成績。
  const score = correctCount * 20;

  // 確保結果頁切換時已經建立正確的特效狀態。
  ensureResultEffectsInitialized();

  // 在結果卡片後方繪製限制於畫布內的結果頁特效。
  drawResultEffects();

  // 設定結果卡片的填滿顏色，避免特效影響結果文字可讀性。
  fill(255, 255, 255, 238);

  // 設定結果卡片的外框顏色。
  stroke(TEXT_COLOR);

  // 設定結果卡片的外框粗細。
  strokeWeight(2);

  // 繪製不超出畫布且能遮蔽背景特效的結果背景方框。
  rect(layout.card.x, layout.card.y, layout.card.w, layout.card.h, layout.cornerRadius);

  // 設定結果文字顏色並移除文字外框。
  fill(TEXT_COLOR);
  noStroke();

  // 設定結果標題文字大小。
  setCanvasFont(layout.titleSize);

  // 顯示測驗完成標題。
  text("測驗完成！", width / 2, layout.titleY);

  // 設定答對題數文字大小。
  setCanvasFont(layout.scoreSize);

  // 顯示答對題數。
  text(`答對 ${correctCount} 題／共 ${questions.length} 題`, width / 2, layout.scoreY);

  // 設定總成績文字大小。
  setCanvasFont(layout.totalScoreSize);

  // 顯示總成績。
  text(`總成績：${score} 分`, width / 2, layout.totalScoreY);

  // 顯示結果頁的中性、成功或加油訊息。
  drawResultMessage(layout);

  // 儲存重新測驗按鈕資料供互動使用。
  restartButton = layout.restartButton;

  // 設定重新測驗按鈕填滿顏色。
  fill(BUTTON_COLOR);

  // 設定重新測驗按鈕外框。
  stroke(TEXT_COLOR);

  // 設定重新測驗按鈕外框粗細。
  strokeWeight(2);

  // 繪製重新測驗按鈕。
  rect(
    restartButton.x,
    restartButton.y,
    restartButton.w,
    restartButton.h,
    layout.cornerRadius
  );

  // 設定重新測驗按鈕文字顏色。
  fill("#ffffff");

  // 移除按鈕文字外框。
  noStroke();

  // 設定重新測驗按鈕文字大小。
  setCanvasFont(layout.buttonTextSize);

  // 顯示重新測驗按鈕文字。
  text(
    "重新測驗",
    restartButton.x + restartButton.w / 2,
    restartButton.y + restartButton.h / 2
  );
}


// 確認結果頁特效已經初始化，避免直接切換畫面時沒有特效狀態。
function ensureResultEffectsInitialized() {
  // 只有尚未設定結果頁特效時才進行初始化。
  if (resultEffectType === "none") {
    // 建立符合目前答題成績的結果頁特效。
    initializeResultEffects();
  }
}

// 依照答對題數決定結果頁要顯示的特效類型。
function initializeResultEffects() {
  // 清除前一次測驗留下的粒子與火箭。
  resetResultEffects();

  // 答對四題或五題時啟用煙火特效。
  if (correctCount > 3) {
    // 設定結果頁特效為煙火。
    resultEffectType = "fireworks";

    // 立即建立第一枚煙火火箭，讓結果頁一開始就有動畫。
    spawnFireworkRocket();
  } else if (correctCount < 3) {
    // 答對零至兩題時啟用加油訊息特效。
    resultEffectType = "encourage";
  } else {
    // 答對三題時使用中性鼓勵訊息，不顯示前兩種特效。
    resultEffectType = "neutral";
  }
}

// 清除結果頁的所有特效資料並恢復初始狀態。
function resetResultEffects() {
  // 清空升空中的煙火火箭。
  fireworkRockets = [];

  // 清空爆炸中的煙火粒子。
  fireworkParticles = [];

  // 重設煙火產生計時器。
  fireworkSpawnTimer = 0;

  // 將結果頁特效類型重設為尚未建立。
  resultEffectType = "none";
}

// 在結果頁繪製煙火、加油動畫或中性背景效果。
function drawResultEffects() {
  // 只有高分結果頁才更新與繪製煙火粒子。
  if (resultEffectType === "fireworks") {
    // 更新煙火火箭與爆炸粒子的物理狀態。
    updateFireworkEffect();

    // 繪製升空火箭與彩色爆炸粒子。
    drawFireworkEffect();
  }
}

// 更新煙火火箭與爆炸粒子的移動、重力和淡出效果。
function updateFireworkEffect() {
  // 讓煙火持續產生，但限制產生頻率以維持畫面流暢。
  fireworkSpawnTimer--;

  // 計時器歸零時建立新的火箭並重新設定間隔。
  if (fireworkSpawnTimer <= 0) {
    // 產生一枚新的煙火火箭。
    spawnFireworkRocket();

    // 設定下一枚火箭的產生間隔。
    fireworkSpawnTimer = floor(random(24, 45));
  }

  // 由後往前更新火箭，方便移除已爆炸的火箭。
  for (let i = fireworkRockets.length - 1; i >= 0; i--) {
    // 取得目前正在升空的火箭。
    const rocket = fireworkRockets[i];

    // 依照速度更新火箭位置。
    rocket.x += rocket.vx;
    rocket.y += rocket.vy;

    // 套用輕微重力，讓火箭升空速度逐漸變慢。
    rocket.vy += 0.12;

    // 將火箭位置限制在畫布範圍內。
    rocket.x = constrain(rocket.x, 0, width);
    rocket.y = constrain(rocket.y, 0, height);

    // 火箭抵達目標高度時建立放射狀爆炸粒子。
    if (rocket.y <= rocket.targetY || rocket.vy >= -1) {
      // 產生目前火箭的爆炸粒子。
      explodeFirework(rocket);

      // 移除已經爆炸的火箭。
      fireworkRockets.splice(i, 1);
    }
  }

  // 由後往前更新爆炸粒子，方便移除透明粒子。
  for (let i = fireworkParticles.length - 1; i >= 0; i--) {
    // 取得目前的煙火粒子。
    const particle = fireworkParticles[i];

    // 依照水平速度更新粒子位置。
    particle.x += particle.vx;

    // 依照垂直速度更新粒子位置。
    particle.y += particle.vy;

    // 套用粒子重力，形成向下掉落的效果。
    particle.vy += particle.gravity;

    // 套用空氣阻力，使粒子逐漸減速。
    particle.vx *= 0.99;

    // 逐幀降低透明度，形成淡出效果。
    particle.alpha -= particle.fadeSpeed;

    // 將粒子位置限制在畫布範圍內。
    particle.x = constrain(particle.x, 0, width);
    particle.y = constrain(particle.y, 0, height);

    // 移除已完全淡出的粒子。
    if (particle.alpha <= 0) {
      // 從粒子陣列移除目前粒子。
      fireworkParticles.splice(i, 1);
    }
  }
}

// 建立一枚從畫布下方升空的煙火火箭。
function spawnFireworkRocket() {
  // 以畫布尺寸建立適合各裝置的升空起點與爆炸高度。
  const startX = random(width * 0.12, width * 0.88);
  const targetY = random(height * 0.12, height * 0.42);

  // 建立火箭資料並加入火箭陣列。
  fireworkRockets.push({
    // 設定火箭的水平位置。
    x: startX,

    // 從畫布底部內側開始，避免超出畫布。
    y: height - 2,

    // 設定火箭的水平速度。
    vx: random(-0.55, 0.55),

    // 設定火箭的初始垂直速度。
    vy: random(-10.5, -8.2),

    // 設定火箭預計爆炸的高度。
    targetY,

    // 隨機選取煙火主色。
    fireworkColor: random([
      "#ff595e",
      "#ffca3a",
      "#8ac926",
      "#1982c4",
      "#c77dff",
      "#ffffff"
    ])
  });
}

// 將單枚火箭轉換成彩色放射狀煙火粒子。
function explodeFirework(rocket) {
  // 設定每次爆炸的粒子數量。
  const particleCount = 56;

  // 建立多方向的彩色粒子。
  for (let i = 0; i < particleCount; i++) {
    // 計算粒子平均分布的爆炸角度。
    const angle = (TWO_PI * i) / particleCount + random(-0.08, 0.08);

    // 計算粒子的初始爆炸速度。
    const speed = random(1.5, 5.2);

    // 將主色與少量亮色混合，增加煙火層次。
    const particleColor = random([
      rocket.fireworkColor,
      rocket.fireworkColor,
      "#ffffff",
      "#ffd166"
    ]);

    // 將新粒子加入粒子陣列。
    fireworkParticles.push({
      // 設定粒子的初始水平位置。
      x: rocket.x,

      // 設定粒子的初始垂直位置。
      y: rocket.y,

      // 依照角度與速度計算水平速度。
      vx: cos(angle) * speed,

      // 依照角度與速度計算垂直速度。
      vy: sin(angle) * speed,

      // 設定粒子的重力大小。
      gravity: random(0.035, 0.075),

      // 設定粒子目前的透明度。
      alpha: 255,

      // 設定粒子每幀的淡出速度。
      fadeSpeed: random(2.1, 3.8),

      // 設定粒子的顯示尺寸。
      size: random(2.2, 5.2),

      // 儲存粒子的顏色。
      particleColor
    });
  }
}

// 繪製升空火箭與限制在畫布內的煙火粒子。
function drawFireworkEffect() {
  // 儲存繪圖狀態，避免特效設定影響結果頁介面。
  push();

  // 使用細線繪製升空中的火箭尾跡，並將端點限制在畫布內。
  for (const rocket of fireworkRockets) {
    // 設定火箭尾跡顏色與透明度。
    stroke(rocket.fireworkColor);
    strokeWeight(2);

    // 繪製從火箭後方延伸的短尾跡。
    line(
      constrain(rocket.x, 0, width),
      constrain(rocket.y + 12, 0, height),
      constrain(rocket.x - rocket.vx * 2, 0, width),
      constrain(rocket.y + 2, 0, height)
    );
  }

  // 關閉線條外框，準備繪製圓形粒子。
  noStroke();

  // 逐一繪製具有淡出透明度的煙火粒子。
  for (const particle of fireworkParticles) {
    // 將粒子顏色轉換為可套用透明度的 p5.js 顏色。
    const particleFill = color(particle.particleColor);

    // 將粒子目前透明度套用到顏色。
    particleFill.setAlpha(constrain(particle.alpha, 0, 255));

    // 設定粒子的填滿顏色。
    fill(particleFill);

    // 繪製彩色圓形粒子。
    ellipse(particle.x, particle.y, particle.size, particle.size);
  }

  // 還原進入本函式前的繪圖狀態。
  pop();
}

// 在結果卡片的安全區域繪製成功、加油或中性鼓勵訊息。
function drawResultMessage(layout) {
  // 儲存目前繪圖狀態，避免訊息設定影響按鈕繪製。
  push();

  // 計算不會超出卡片的訊息文字大小。
  const messageSize = layout.messageSize;

  // 依照時間產生上下浮動與脈動效果。
  const floatingOffset = sin(frameCount * 0.08) * layout.messageFloat;
  const pulse = 1 + sin(frameCount * 0.1) * 0.06;

  // 將訊息位置限制在卡片下半部安全區域。
  const messageY = constrain(
    layout.messageY + floatingOffset,
    layout.card.y + layout.card.h * 0.78,
    layout.card.y + layout.card.h * 0.93
  );

  // 依照特效類型決定訊息內容與顏色。
  let message = "繼續保持！";
  let messageColor = color(TEXT_COLOR);

  // 高分時顯示成功訊息，搭配背景煙火。
  if (resultEffectType === "fireworks") {
    // 設定高分鼓勵文字。
    message = "太棒了！";

    // 設定高分鼓勵文字顏色。
    messageColor = color("#d62828");
  } else if (resultEffectType === "encourage") {
    // 設定低分時醒目的加油文字。
    message = "繼續加油！";

    // 設定加油文字顏色。
    messageColor = color("#e85d04");
  }

  // 將訊息套用脈動大小，並限制在畫布可讀範圍。
  setCanvasFont(constrain(messageSize * pulse, 12, 30));

  // 繪製柔和的半透明文字底層，增強訊息辨識度。
  fill(255, 255, 255, 180);
  noStroke();
  text(message, width / 2 + 2, messageY + 2);

  // 繪製主要訊息文字。
  fill(messageColor);
  text(message, width / 2, messageY);

  // 還原繪圖狀態。
  pop();
}

// 建立目前畫面專用的響應式版面資料。
function getLayout() {
  // 取得目前題目，讓題目與選項文字能參與尺寸計算。
  const currentQuestion = questions[currentQuestionIndex];

  // 以畫布短邊估算介面縮放比例，兼顧直向與橫向裝置。
  const baseScale = constrain(min(width, height) / 700, 0.52, 1.1);

  // 設定安全邊界，確保所有元件都留在畫布內。
  const margin = constrain(min(width, height) * 0.05, 12, 42);

  // 設定內容最大寬度，避免桌面螢幕上的元件過度拉寬。
  const contentWidth = max(1, min(width - margin * 2, 980));

  // 小螢幕直向優先使用單欄，其餘空間充足的情況使用雙欄。
  const preferredColumns = width < 620 && height >= width ? 1 : 2;

  // 建立另一種欄數作為空間不足時的備用方案。
  const alternateColumns = preferredColumns === 1 ? 2 : 1;

  // 由大到小嘗試介面尺寸，讓短螢幕也能容納完整內容。
  const scaleSteps = [
    baseScale,
    baseScale - 0.08,
    baseScale - 0.16,
    baseScale - 0.24,
    0.52
  ];

  // 宣告目前找到的最佳版面。
  let bestLayout = null;

  // 依序嘗試不同文字大小與欄數。
  for (const scale of scaleSteps) {
    // 忽略低於最小可讀尺寸的重複計算。
    if (scale < 0.5) {
      continue;
    }

    // 先嘗試符合裝置方向偏好的欄數。
    const primaryLayout = buildLayoutCandidate(
      preferredColumns,
      scale,
      margin,
      contentWidth,
      currentQuestion
    );

    // 如果單欄或雙欄已經有足夠高度，就直接採用。
    if (primaryLayout.isUsable) {
      return primaryLayout;
    }

    // 再嘗試另一種欄數，避免極短畫面內容被裁切。
    const alternateLayout = buildLayoutCandidate(
      alternateColumns,
      scale,
      margin,
      contentWidth,
      currentQuestion
    );

    // 保留目前空間利用率較高的版面作為最後備案。
    if (!bestLayout || alternateLayout.optionHeight > bestLayout.optionHeight) {
      bestLayout = alternateLayout;
    }

    // 若備用欄數可完整容納內容，就立即使用備用版面。
    if (alternateLayout.isUsable) {
      return alternateLayout;
    }
  }

  // 極小畫布仍回傳一個不重疊的最佳版面，避免函式沒有結果。
  return bestLayout || buildLayoutCandidate(
    preferredColumns,
    0.5,
    margin,
    contentWidth,
    currentQuestion
  );
}

// 建立指定欄數的候選版面並檢查是否能完整容納。
function buildLayoutCandidate(columns, scale, margin, contentWidth, currentQuestion) {
  // 計算各種文字大小，並限制在適合閱讀的範圍。
  const titleSize = constrain(34 * scale, 18, 34);
  const infoSize = constrain(18 * scale, 12, 18);
  const questionSize = constrain(25 * scale, 14, 26);
  const buttonTextSize = constrain(20 * scale, 13, 20);

  // 計算各種文字的行高，讓換行文字不會互相重疊。
  const titleLineHeight = titleSize * 1.28;
  const questionLineHeight = questionSize * 1.35;
  const optionLineHeight = max(15, questionSize * 0.98);

  // 設定題目與選項的內距。
  const questionPadding = max(10, 18 * scale);
  const optionPadding = max(8, 14 * scale);

  // 設定圓角半徑與元件間距。
  const cornerRadius = constrain(12 * scale, 7, 14);
  const titleLines = measureWrappedLines(
    "程式設計簡易指令練習測驗",
    contentWidth,
    titleSize
  );
  const titleHeight = max(titleSize * 1.3, titleLines.length * titleLineHeight);

  // 由上往下安排標題與題數文字位置。
  const titleY = margin + titleHeight / 2;
  const infoHeight = infoSize * 1.3;
  const infoY = margin + titleHeight + infoHeight / 2 + max(5, 5 * scale);

  // 計算題目文字換行後的行數。
  const questionMaxWidth = max(1, contentWidth * 0.96);
  const questionLines = measureWrappedLines(
    currentQuestion.question,
    questionMaxWidth,
    questionSize
  );

  // 依照換行行數自動決定題目方框高度。
  const questionHeight = max(
    questionSize * 1.8,
    questionLines.length * questionLineHeight + questionPadding * 2
  );

  // 設定題目方框的位置與大小。
  const questionBox = {
    x: width / 2 - contentWidth / 2,
    y: infoY + infoHeight / 2 + max(10, 14 * scale),
    w: contentWidth,
    h: questionHeight
  };

  // 計算選項與按鈕之間的垂直空間。
  const optionStartY = questionBox.y + questionBox.h + max(10, 14 * scale);
  const buttonH = constrain(58 * scale, 44, 60);
  const buttonY = height - margin - buttonH;
  const optionButtonGap = constrain(14 * scale, 8, 18);
  const rowGap = constrain(16 * scale, 8, 18);
  const rows = ceil(4 / columns);
  const availableOptionHeight = buttonY - optionButtonGap - optionStartY;
  const desiredOptionHeight = constrain(78 * scale, 42, 88);

  // 依照欄數與剩餘高度計算每個選項的高度。
  const optionHeight = max(
    1,
    min(
      desiredOptionHeight,
      (availableOptionHeight - rowGap * (rows - 1)) / rows
    )
  );

  // 計算單欄或雙欄的選項寬度與欄間距。
  const columnGap = columns === 2 ? min(24, contentWidth * 0.04) : 0;
  const optionWidth = columns === 2
    ? (contentWidth - columnGap) / 2
    : contentWidth;
  const leftX = width / 2 - contentWidth / 2;

  // 依照欄數建立四個選項的矩形位置。
  const options = [];
  for (let i = 0; i < 4; i++) {
    // 計算目前選項所在的欄與列。
    const column = columns === 1 ? 0 : i % 2;
    const row = columns === 1 ? i : floor(i / 2);

    // 將目前選項加入版面資料陣列。
    options.push({
      x: leftX + column * (optionWidth + columnGap),
      y: optionStartY + row * (optionHeight + rowGap),
      w: optionWidth,
      h: optionHeight
    });
  }

  // 依照最窄的選項方框計算不會裁切的選項文字大小。
  const optionSize = fitOptionTextSize(
    currentQuestion.options,
    optionWidth,
    optionHeight,
    optionPadding,
    scale
  );

  // 只有選項高度與位置都有效時，才視為可完整使用的版面。
  const optionBottom = options[3].y + options[3].h;
  const isUsable =
    optionHeight >= 34 &&
    optionBottom <= buttonY - optionButtonGap + 0.5 &&
    buttonY >= optionBottom + optionButtonGap - 0.5 &&
    optionSize >= 10;

  // 回傳本候選版面所有繪圖與互動需要的資料。
  return {
    // 回傳目前候選版面是否可完整使用。
    isUsable,

    // 回傳內容最大寬度。
    contentWidth,

    // 回傳各種文字大小。
    titleSize,
    infoSize,
    questionSize,
    optionSize,
    buttonTextSize,

    // 回傳各種文字行高。
    titleLineHeight,
    questionLineHeight,
    optionLineHeight,

    // 回傳方框與間距資料。
    cornerRadius,
    questionPadding,
    optionPadding,
    animationDistance: max(4, min(10, 9 * scale)),
    questionBox,
    options,
    optionHeight,

    // 回傳標題、題數與按鈕的位置資料。
    titleY,
    infoY,
    nextButton: {
      x: width / 2 - min(contentWidth * 0.62, 300) / 2,
      y: buttonY,
      w: min(contentWidth * 0.62, 300),
      h: buttonH
    }
  };
}

// 取得結果頁的響應式版面資料。
function getResultLayout() {
  // 依照畫布短邊計算結果頁的縮放比例。
  const scale = constrain(min(width, height) / 700, 0.52, 1.1);

  // 設定結果頁的安全邊界。
  const margin = constrain(min(width, height) * 0.06, 14, 42);

  // 計算結果頁文字大小。
  const titleSize = constrain(36 * scale, 20, 38);
  const scoreSize = constrain(25 * scale, 16, 28);
  const totalScoreSize = constrain(30 * scale, 18, 32);
  const buttonTextSize = constrain(20 * scale, 13, 20);
  const buttonH = constrain(58 * scale, 44, 60);
  const buttonW = min(max(160, width * 0.58), 300);
  const buttonY = height - margin - buttonH;

  // 設定結果卡片的寬度與高度，並限制在畫布範圍內。
  const cardW = min(max(220, width * 0.86), 620, width - margin * 2);
  const cardH = min(max(220, height * 0.58), 420, buttonY - margin);
  const card = {
    x: width / 2 - cardW / 2,
    y: margin,
    w: cardW,
    h: max(1, cardH)
  };

  // 使用卡片內的相對位置安排結果文字，避免不同螢幕重疊。
  const titleY = card.y + card.h * 0.25;
  const scoreY = card.y + card.h * 0.52;
  const totalScoreY = card.y + card.h * 0.72;
  const messageY = card.y + card.h * 0.87;

  // 儲存重新測驗按鈕的完整互動範圍。
  const restartButton = {
    x: width / 2 - buttonW / 2,
    y: buttonY,
    w: buttonW,
    h: buttonH
  };

  // 回傳結果頁繪圖所需的全部資料。
  return {
    titleSize,
    scoreSize,
    totalScoreSize,
    buttonTextSize,
    messageSize: constrain(22 * scale, 14, 24),
    messageFloat: constrain(5 * scale, 2, 5),
    cornerRadius: constrain(12 * scale, 7, 14),
    card,
    titleY,
    scoreY,
    totalScoreY,
    messageY,
    restartButton
  };
}

// 依照方框寬度切割文字，支援中文與英文混合內容。
function measureWrappedLines(message, maxWidth, fontSize) {
  // 先設定測量文字時使用的字型大小。
  setCanvasFont(fontSize);

  // 將文字依照手動換行符號分成多個段落。
  const paragraphs = String(message).split("\n");

  // 建立所有自動換行後的文字行。
  const lines = [];

  // 逐段處理文字內容。
  for (const paragraph of paragraphs) {
    // 建立目前正在累積的文字行。
    let currentLine = "";

    // 逐字加入內容並檢查寬度。
    for (const character of paragraph) {
      // 試算加入新字元後的文字寬度。
      const testLine = currentLine + character;

      // 超過最大寬度時先完成上一行。
      if (textWidth(testLine) > maxWidth && currentLine.length > 0) {
        // 將目前文字行加入結果陣列。
        lines.push(currentLine);

        // 將目前字元放到下一行。
        currentLine = character;
      } else {
        // 尚未超過寬度時繼續累積文字。
        currentLine = testLine;
      }
    }

    // 將段落最後剩餘的文字加入結果陣列。
    lines.push(currentLine);
  }

  // 空字串也至少保留一行，避免計算高度為零。
  return lines.length > 0 ? lines : [""];
}

// 依照目前字型大小取得文字換行結果。
function wrapTextLines(message, maxWidth, fontSize) {
  // 使用傳入的字型大小測量文字行，避免依賴 setCanvasFont() 的讀取行為。
  return measureWrappedLines(message, maxWidth, fontSize);
}

// 找出能放入選項方框且不會被裁切的字型大小。
function fitOptionTextSize(optionTexts, optionWidth, optionHeight, padding, scale) {
  // 從依裝置大小估算的字型大小開始嘗試。
  let size = constrain(20 * scale, 12, 21);

  // 逐步縮小字型直到所有選項都能完整顯示。
  for (let attempt = 0; attempt < 12; attempt++) {
    // 設定本次測試的文字大小。
    setCanvasFont(size);

    // 計算所有選項中最多的換行行數。
    let maximumLines = 1;
    for (const optionText of optionTexts) {
      // 加入選項英文字母標籤後再進行測量。
      const lines = measureWrappedLines(
        `A. ${optionText}`,
        max(1, optionWidth - padding * 2),
        size
      );

      // 保留行數最多的選項結果。
      maximumLines = max(maximumLines, lines.length);
    }

    // 計算文字加上上下內距後的需求高度。
    const neededHeight = maximumLines * size * 1.25 + padding;

    // 如果高度足夠，就回傳本次字型大小。
    if (neededHeight <= optionHeight) {
      return size;
    }

    // 高度不足時降低字型大小後重新測試。
    size -= 0.8;
  }

  // 回傳安全的最小字型大小，避免結果為負值。
  return max(10, size);
}

// 將可換行文字以垂直置中的方式畫在指定位置。
function drawWrappedText(message, x, y, maxWidth, lineHeight, fontSize) {
  // 取得目前字型大小下的換行文字行。
  const lines = wrapTextLines(message, maxWidth, fontSize);

  // 計算所有文字行的總高度。
  const totalHeight = lines.length * lineHeight;

  // 計算第一行文字的中心位置。
  let currentY = y - totalHeight / 2 + lineHeight / 2;

  // 逐行繪製文字內容。
  for (const line of lines) {
    // 將本行文字畫在指定中心位置。
    text(line, x, currentY);

    // 將下一行往下移動一個行高。
    currentY += lineHeight;
  }
}

// 判斷指定座標是否位於某個矩形範圍內。
function isInside(px, py, box) {
  // 回傳座標是否同時落在矩形的水平與垂直範圍。
  return Boolean(
    box &&
    px >= box.x &&
    px <= box.x + box.w &&
    py >= box.y &&
    py <= box.y + box.h
  );
}

// 統一處理滑鼠與觸控點擊，避免兩種操作行為不一致。
function handlePointer(px, py) {
  // 題庫載入中或載入失敗時禁止所有選項與按鈕互動。
  if (questionDataState !== "ready" || questions.length < QUIZ_QUESTION_COUNT) {
    // 尚未準備好時不執行任何點擊行為。
    return;
  }

  // 如果目前位於測驗頁面，就處理選項或下一題按鈕。
  if (screenState === "quiz") {
    // 尚未作答時只允許點擊選項。
    if (!answered) {
      // 取得目前尺寸下的選項版面。
      const layout = getLayout();

      // 逐一檢查四個選項是否被點擊。
      for (let i = 0; i < layout.options.length; i++) {
        // 判斷點擊位置是否落在目前選項內。
        if (isInside(px, py, layout.options[i])) {
          // 記錄使用者選取的選項索引。
          selectedIndex = i;

          // 將本題狀態設定為已作答。
          answered = true;

          // 選取正確答案時增加答對題數。
          if (selectedIndex === questions[currentQuestionIndex].answerIndex) {
            correctCount++;
          }

          // 完成選項處理後離開函式。
          return;
        }
      }
    } else {
      // 已作答時取得目前的下一題按鈕版面。
      const layout = getLayout();

      // 判斷是否點擊下一題按鈕。
      if (isInside(px, py, layout.nextButton)) {
        // 最後一題點擊後切換到結果頁。
        if (currentQuestionIndex === questions.length - 1) {
          // 初始化結果頁特效，讓煙火或加油訊息從零開始播放。
          initializeResultEffects();

          // 將畫面狀態切換為結果頁。
          screenState = "result";
        } else {
          // 將題目索引移到下一題。
          currentQuestionIndex++;

          // 清除上一題的選項選取狀態。
          selectedIndex = -1;

          // 設定下一題為尚未作答。
          answered = false;
        }

        // 完成按鈕處理後離開函式。
        return;
      }
    }
  } else {
    // 結果頁只處理重新測驗按鈕。
    const layout = getResultLayout();

    // 判斷是否點擊重新測驗按鈕。
    if (isInside(px, py, layout.restartButton)) {
      // 從完整題庫重新洗牌並抽出五題。
      startNewQuiz();
    }
  }
}

// 處理滑鼠按下事件。
function mousePressed() {
  // 忽略觸控後瀏覽器可能補發的滑鼠事件。
  if (millis() < ignoreMouseUntil) {
    // 回傳 false 取消預設滑鼠行為。
    return false;
  }

  // 將滑鼠座標交給統一互動函式處理。
  handlePointer(mouseX, mouseY);

  // 回傳 false 避免瀏覽器執行額外預設行為。
  return false;
}

// 處理觸控開始事件。
function touchStarted() {
  // 設定短暫忽略時間，避免同一次觸控觸發兩次作答。
  ignoreMouseUntil = millis() + 500;

  // 確認至少存在一個觸控點後再處理。
  if (touches.length > 0) {
    // 使用第一個觸控點作為互動座標。
    handlePointer(touches[0].x, touches[0].y);
  }

  // 回傳 false 防止觸控造成頁面捲動或縮放。
  return false;
}

// 當瀏覽器視窗尺寸改變時重新調整全螢幕畫布。
function windowResized() {
  // 將畫布調整為最新的瀏覽器視窗寬高。
  resizeCanvas(windowWidth, windowHeight);
}
