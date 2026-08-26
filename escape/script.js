/* ---------------- state ---------------- */
let rooms = [];
let editingIndex = null;
let currentPlayRoom = null;
let currentStageIndex = 0;
let playSeconds = 0;
let playTimerInterval = null;
let hintState = {}; 

let draftTitle = "마실길";
let draftProducer = "작은손";
let draftStory = "";
let draftStages = []; 
let scenarioGenerated = false;

function loadDefaultRooms() {
  fetch('./data.json')
    .then(response => response.json())
    .then(data => {
      rooms = data;
      renderRoomList();
    })
    .catch(err => {
      console.error("JSON 데이터를 불러오는 중 오류 발생:", err);
    });
}

function initDraftStages() {
  draftStages = [
    { photo: null, story: "", prompt: "", hintText: "", hintPhoto: null, answer: "" }
  ];
}

function goTo(view) {
  ['landing','maker','userSelect','play'].forEach(v => {
    document.getElementById('view-' + v).classList.add('hidden');
  });
  document.getElementById('view-' + view).classList.remove('hidden');
  if (view === 'maker') {
    if (editingIndex === null) {
      resetMakerForm();
    } else {
      renderStagePhotos();
      if (scenarioGenerated) renderScenarioFlow();
    }
    renderRoomList();
  }
  if (view === 'userSelect') renderUserSelect();
}

function resetMakerForm() {
  editingIndex = null;
  draftTitle = "마실길";
  draftProducer = "작은손";
  draftStory = "";
  scenarioGenerated = false;
  document.getElementById('titleInput').value = draftTitle;
  document.getElementById('producerInput').value = draftProducer;
  document.getElementById('storyInput').value = draftStory;
  document.getElementById('questBoard').classList.add('hidden');
  document.getElementById('registerBtn').textContent = "방탈출 등록하기";
  document.getElementById('cancelEditBtn').style.display = "none";
  initDraftStages();
  renderStagePhotos();
  checkGenBtn();
}

function renderStagePhotos() {
  const container = document.getElementById('stagePhotoRow');
  container.innerHTML = '';
  draftStages.forEach((st, idx) => {
    const card = document.createElement('div');
    card.className = 'polaroid';
    card.onclick = (e) => {
      if (e.target.tagName !== 'A' && e.target.tagName !== 'INPUT') {
        card.querySelector('input[type=file]').click();
      }
    };
    
    let innerHTML = `<div class="pin-dot"></div>`;
    if (st.photo) {
      innerHTML += `<div class="frame"><img src="${st.photo}"></div>`;
    } else {
      innerHTML += `<div class="frame">+ 사진 등록</div>`;
    }
    innerHTML += `<div class="cap">STEP ${idx+1}`;
    if (draftStages.length > 1) {
      innerHTML += ` &middot; <a onclick="removeStage(event, ${idx})">삭제</a>`;
    }
    innerHTML += `</div>`;
    innerHTML += `<input type="file" accept="image/*" onchange="handleStagePhotoUpload(event, ${idx})">`;
    
    card.innerHTML = innerHTML;
    container.appendChild(card);
  });
}

function handleStagePhotoUpload(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    draftStages[idx].photo = evt.target.result;
    renderStagePhotos();
    checkGenBtn();
  };
  reader.readAsDataURL(file);
}

function addStage() {
  if (draftStages.length >= 10) {
    alert('최대 10단계까지 생성 가능합니다.');
    return;
  }
  draftStages.push({ photo: null, story: "", prompt: "", hintText: "", hintPhoto: null, answer: "" });
  renderStagePhotos();
  checkGenBtn();
}

function removeStage(e, idx) {
  e.stopPropagation();
  if (draftStages.length <= 1) {
    alert('최소 1개의 단계가 필요합니다.');
    return;
  }
  draftStages.splice(idx, 1);
  renderStagePhotos();
  if (scenarioGenerated) renderScenarioFlow();
  checkGenBtn();
}

function checkGenBtn() {
  const btn = document.getElementById('genBtn');
  const hasPhoto = draftStages.some(s => s.photo !== null);
  btn.disabled = !hasPhoto;
}

function generateSuggestions() {
  scenarioGenerated = true;
  document.getElementById('questBoard').classList.remove('hidden');
  renderScenarioFlow();
  document.getElementById('scenarioFlow').scrollIntoView({ behavior: 'smooth' });
}

function renderScenarioFlow() {
  const container = document.getElementById('scenarioFlow');
  container.innerHTML = '';

  draftStages.forEach((st, idx) => {
    const div = document.createElement('div');
    div.className = 'stage-unit';
    
    let html = `
      <div class="stage-num">
        <div class="left-group">
          <span>STEP ${idx+1} · 단서 분석 & 시나리오</span>
          <span class="ai-badge">AI SUGGESTION</span>
        </div>
      </div>
      <div class="stage-photo-row">
        <div class="polaroid" style="width:100px;padding:6px 6px 18px;margin:0;cursor:default;">
          <div class="pin-dot"></div>
          <div class="frame" style="height:75px;">
            ${st.photo ? `<img src="${st.photo}">` : '노사진'}
          </div>
          <div class="cap" style="font-size:9px;">단서 ${idx+1}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <label class="field-label" style="font-size:10px;margin-bottom:4px;">스토리 / 서사</label>
          <textarea oninput="draftStages[${idx}].story = this.value" placeholder="이 단서 사진에서 발견할 수 있는 스토리를 작성하세요...">${st.story || ''}</textarea>
        </div>
      </div>

      <div class="quest-block">
        <div class="quest-block-head">
          <span>현장 퀘스트 &amp; 단서 문제</span>
          <button class="ghost-dark tiny-btn prompt-toggle-btn" onclick="togglePromptPanel(${idx})">🤖 AI 생성 프롬프트 보기</button>
        </div>
        
        <div class="prompt-panel" id="promptPanel_${idx}">
          <div class="prompt-block">
            <div class="p-lbl"><span>[프롬프트] ChatGPT / Claude 전달용</span><button class="ghost tiny-btn" onclick="copyPrompt(${idx})">복사</button></div>
            <textarea id="promptText_${idx}" readonly>${generatePromptText(idx)}</textarea>
          </div>
        </div>

        <div class="hint-edit-row">
          <div class="hint-thumb-wrap">
            <label class="thumb-upload">
              ${st.hintPhoto ? `<img src="${st.hintPhoto}">` : ''}
              <div class="thumb-overlay">${st.hintPhoto ? '변경' : '+ 힌트 사진'}</div>
              <input type="file" accept="image/*" onchange="handleHintPhotoUpload(event, ${idx})">
            </label>
            <span class="thumb-cap">힌트 이미지</span>
          </div>
          <div class="hint-text-wrap">
            <label>힌트 텍스트</label>
            <textarea oninput="draftStages[${idx}].hintText = this.value" placeholder="플레이어가 힌트 버튼을 누르면 표시될 텍스트...">${st.hintText || ''}</textarea>
          </div>
        </div>

        <div class="answer-field">
          <label>정답 (키워드/숫자)</label>
          <input type="text" value="${st.answer || ''}" oninput="draftStages[${idx}].answer = this.value" placeholder="예) 100, 선린문, 1892">
        </div>
      </div>
    `;
    div.innerHTML = html;
    container.appendChild(div);
  });
}

function handleHintPhotoUpload(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    draftStages[idx].hintPhoto = evt.target.result;
    renderScenarioFlow();
  };
  reader.readAsDataURL(file);
}

function togglePromptPanel(idx) {
  const panel = document.getElementById(`promptPanel_${idx}`);
  panel.classList.toggle('open');
}

function generatePromptText(idx) {
  const st = draftStages[idx];
  return `[사건 제목: ${draftTitle}]
[전체 스토리 컨셉: ${document.getElementById('storyInput').value || '자유 스토리'}]
[현재 단계: ${idx+1}단계 / 총 ${draftStages.length}단계]
[현재 단계 스토리: ${st.story || '현장 단서 사진 기반'}]

위 정보를 바탕으로, 플레이어가 현장에서 사진을 보고 맞출 수 있는 '방탈출 문제(퀘스트)', '힌트(텍스트/이미지 아이디어)', '정답(단어/숫자)'을 추천해줘.`;
}

function copyPrompt(idx) {
  const txt = document.getElementById(`promptText_${idx}`).value;
  navigator.clipboard.writeText(txt).then(() => {
    alert('프롬프트가 클립보드에 복사되었습니다!');
  });
}

function registerRoom() {
  const title = document.getElementById('titleInput').value.trim() || '제목 없음';
  const producer = document.getElementById('producerInput').value.trim() || '익명';
  const story = document.getElementById('storyInput').value.trim();

  const newRoom = {
    title,
    producer,
    story,
    prologue: story,
    epilogue: "모든 단서를 찾고 사건을 해결했습니다! 축하합니다.",
    stages: JSON.parse(JSON.stringify(draftStages))
  };

  if (editingIndex !== null) {
    rooms[editingIndex] = newRoom;
    alert('사건 파일이 수정되었습니다.');
  } else {
    rooms.push(newRoom);
    alert('새로운 사건 파일이 등록되었습니다!');
  }

  resetMakerForm();
  renderRoomList();
}

function cancelEdit() {
  resetMakerForm();
}

function renderRoomList() {
  const countEl = document.getElementById('roomCount');
  const bodyEl = document.getElementById('roomListBody');
  if (countEl) countEl.textContent = rooms.length;
  if (!bodyEl) return;

  bodyEl.innerHTML = '';
  if (rooms.length === 0) {
    bodyEl.innerHTML = '<div class="empty-note">등록된 사건 파일이 없습니다.</div>';
    return;
  }

  rooms.forEach((r, idx) => {
    const item = document.createElement('div');
    item.className = 'room-item';
    item.innerHTML = `
      <div>
        <div class="name">${r.title}</div>
        <div class="meta">제작자: ${r.producer} · 단계: ${r.stages.length}단계</div>
      </div>
      <div class="actions">
        <button class="ghost-dark small-btn" onclick="previewRoomModal(${idx})">미리보기</button>
        <button class="ghost-dark small-btn" onclick="editRoom(${idx})">수정</button>
        <button class="danger small-btn" onclick="deleteRoom(${idx})">삭제</button>
      </div>
    `;
    bodyEl.appendChild(item);
  });
}

function editRoom(idx) {
  editingIndex = idx;
  const r = rooms[idx];
  draftTitle = r.title;
  draftProducer = r.producer;
  draftStory = r.story || r.prologue || '';
  draftStages = JSON.parse(JSON.stringify(r.stages));
  scenarioGenerated = true;

  document.getElementById('titleInput').value = draftTitle;
  document.getElementById('producerInput').value = draftProducer;
  document.getElementById('storyInput').value = draftStory;

  document.getElementById('questBoard').classList.remove('hidden');
  document.getElementById('registerBtn').textContent = "수정 완료하기";
  document.getElementById('cancelEditBtn').style.display = "inline-block";

  renderStagePhotos();
  renderScenarioFlow();
  checkGenBtn();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteRoom(idx) {
  if (confirm('이 사건 파일을 삭제하시겠습니까?')) {
    rooms.splice(idx, 1);
    renderRoomList();
  }
}

function exportRoomsToJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rooms, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "masilgil_rooms.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importRoomsFromJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        rooms = imported;
        renderRoomList();
        alert('JSON 데이터를 성공적으로 불러왔습니다!');
      } else {
        alert('올바른 JSON 형식이 아닙니다.');
      }
    } catch (err) {
      alert('파일 읽기 오류: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function renderUserSelect() {
  const container = document.getElementById('roomSelectBody');
  container.innerHTML = '';

  if (rooms.length === 0) {
    container.innerHTML = '<div class="empty-note">현재 플레이 가능한 사건 파일이 없습니다.<br>MAKER 모드에서 사건을 등록해주세요.</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'room-select-grid';

  rooms.forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.onclick = () => startPlay(idx);
    card.innerHTML = `
      <h4>${r.title}</h4>
      <div class="producer">제작자: ${r.producer}</div>
      <p>${(r.prologue || r.story || '').substring(0, 80)}...</p>
      <div style="margin-top:14px;"><button style="width:100%;">사건 개시 &rarr;</button></div>
    `;
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function startPlay(idx) {
  currentPlayRoom = rooms[idx];
  currentStageIndex = 0;
  playSeconds = 0;
  hintState = { textShown: false, photoShown: false, answerRevealed: false };

  if (playTimerInterval) clearInterval(playTimerInterval);
  playTimerInterval = setInterval(() => {
    playSeconds++;
    updateTimerDisplay();
  }, 1000);

  goTo('play');
  renderPlayStage();
}

function updateTimerDisplay() {
  const el = document.getElementById('playTimer');
  if (!el) return;
  const m = Math.floor(playSeconds / 60).toString().padStart(2, '0');
  const s = (playSeconds % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function renderPlayStage() {
  const wrap = document.getElementById('playWrap');
  const room = currentPlayRoom;
  const stage = room.stages[currentStageIndex];
  const total = room.stages.length;

  let progressDots = '';
  for (let i = 0; i < total; i++) {
    let cls = 'step-dot';
    if (i < currentStageIndex) cls += ' done';
    else if (i === currentStageIndex) cls += ' active';
    progressDots += `<div class="${cls}"></div>`;
  }

  let html = `
    <div class="play-head">
      <h2>${room.title}</h2>
      <div class="timer" id="playTimer">00:00</div>
    </div>
    <div class="play-producer">제작자 · ${room.producer}</div>
    <div class="quest-progress">${progressDots}</div>

    ${currentStageIndex === 0 && room.prologue ? `<div class="briefing"><b>[사건 브리핑]</b><br>${room.prologue.replace(/\n/g, '<br>')}</div>` : ''}

    ${stage.photo ? `<img src="${stage.photo}" class="play-photo">` : `<div class="play-photo-frame">현장 단서 사진 없음</div>`}

    ${stage.story ? `<div style="max-width:420px;margin:0 auto 16px;font-size:13.5px;line-height:1.6;color:var(--ink-soft);">${stage.story.replace(/\n/g, '<br>')}</div>` : ''}

    <div class="answer-row">
      <input type="text" id="playAnswerInput" placeholder="정답 입력..." onkeypress="if(event.key==='Enter') checkAnswer()">
      <button onclick="checkAnswer()">확인</button>
    </div>
    <div class="feedback" id="playFeedback"></div>

    <div class="hint-zone">
      <div class="hint-btn-row">
        ${stage.hintText ? `<button class="ghost-dark tiny-btn" onclick="showHintText()">힌트 텍스트 보기</button>` : ''}
        ${stage.hintPhoto ? `<button class="ghost-dark tiny-btn" onclick="showHintPhoto()">힌트 사진 보기</button>` : ''}
        <button class="ghost-dark tiny-btn" style="color:var(--string);border-color:var(--string);" onclick="revealAnswer()">정답 공개</button>
      </div>
      <div id="hintContentArea"></div>
    </div>
  `;

  wrap.innerHTML = html;
  updateTimerDisplay();
}

function showHintText() {
  hintState.textShown = true;
  updateHintArea();
}

function showHintPhoto() {
  hintState.photoShown = true;
  updateHintArea();
}

function revealAnswer() {
  if (confirm('정답을 공개하시겠습니까?')) {
    hintState.answerRevealed = true;
    updateHintArea();
  }
}

function updateHintArea() {
  const area = document.getElementById('hintContentArea');
  if (!area) return;
  const stage = currentPlayRoom.stages[currentStageIndex];
  let html = '';

  if (hintState.textShown && stage.hintText) {
    html += `<div class="hint-text">💡 힌트: ${stage.hintText}</div>`;
  }
  if (hintState.photoShown && stage.hintPhoto) {
    html += `<img src="${stage.hintPhoto}" class="hint-img">`;
  }
  if (hintState.answerRevealed) {
    html += `<div class="answer-reveal">🔓 정답: ${stage.answer}</div>`;
  }
  area.innerHTML = html;
}

function checkAnswer() {
  const input = document.getElementById('playAnswerInput');
  const fb = document.getElementById('playFeedback');
  if (!input || !fb) return;

  const val = input.value.trim().toLowerCase();
  const target = (currentPlayRoom.stages[currentStageIndex].answer || '').trim().toLowerCase();

  if (!val) return;

  if (val === target || (target === '' && val !== '')) {
    fb.className = 'feedback ok';
    fb.textContent = 'Correct! 다음 단서로 이동합니다...';
    setTimeout(() => {
      currentStageIndex++;
      hintState = { textShown: false, photoShown: false, answerRevealed: false };
      if (currentStageIndex >= currentPlayRoom.stages.length) {
        finishPlay();
      } else {
        renderPlayStage();
      }
    }, 1000);
  } else {
    fb.className = 'feedback no';
    fb.textContent = 'Incorrect! 다시 시도해보세요.';
  }
}

function finishPlay() {
  if (playTimerInterval) clearInterval(playTimerInterval);
  const wrap = document.getElementById('playWrap');
  const room = currentPlayRoom;

  const m = Math.floor(playSeconds / 60).toString().padStart(2, '0');
  const s = (playSeconds % 60).toString().padStart(2, '0');

  let html = `
    <div class="clear-screen">
      <h2>CASE CLEARED!</h2>
      <div class="time-big">${m}:${s}</div>
      ${room.epilogue ? `<div class="epilogue">${room.epilogue.replace(/\n/g, '<br>')}</div>` : ''}
      <button onclick="goTo('userSelect')">사건 목록으로 돌아가기</button>
    </div>
  `;
  wrap.innerHTML = html;
}

function previewRoomModal(idx) {
  const r = rooms[idx];
  const root = document.getElementById('modalRoot');

  let stageList = '';
  r.stages.forEach((st, sIdx) => {
    stageList += `
      <div class="quest-view">
        <b>STEP ${sIdx+1}</b>
        ${st.photo ? `<img src="${st.photo}">` : ''}
        <div>${st.story || ''}</div>
        <div style="font-size:11px;color:var(--stamp);margin-top:4px;">정답: ${st.answer || '미지정'}</div>
      </div>
    `;
  });

  root.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <button class="modal-close-x" onclick="closeModal()">&times;</button>
        <h3>${r.title}</h3>
        <div class="producer">제작자: ${r.producer}</div>
        
        <div class="section-lbl">스토리 / 브리핑</div>
        <p>${(r.prologue || r.story || '내용 없음').replace(/\n/g, '<br>')}</p>

        <div class="section-lbl">단계별 단서 (${r.stages.length}단계)</div>
        ${stageList}

        <div class="modal-close-row">
          <button onclick="closeModal()">닫기</button>
        </div>
      </div>
    </div>
  `;
}

function openPromptExampleModal() {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <button class="modal-close-x" onclick="closeModal()">&times;</button>
        <h3>프롬프트 활용 예시</h3>
        <p>AI(ChatGPT, Claude 등)에게 아래와 같이 요청하면 완성도 높은 방탈출 시나리오와 퀘스트를 추천받을 수 있습니다.</p>
        
        <div class="prompt-example-box">[역할 설정]
당신은 베테랑 오프라인 방탈출 게임 디자이너입니다.

[사건 정보]
제목: 차이나타운의 숨겨진 보물
장소: 인천 차이나타운 거리

[요청 사항]
제시된 3장의 사진 단서를 활용해 흥미진진한 3단계 방탈출 퀘스트를 설계해주세요.
각 단계마다 플레이어가 현장에서 관찰하여 풀 수 있는 문제와 힌트, 정답을 추천해주세요.</div>

        <div class="modal-close-row">
          <button onclick="closeModal()">닫기</button>
        </div>
      </div>
    </div>
  `;
}

function openPrivacyModal() {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <button class="modal-close-x" onclick="closeModal()">&times;</button>
        <h3>개인정보처리방침</h3>
        <p>본 프로토타입 웹 애플리케이션은 사용자의 어떠한 개인정보도 서버에 저장하지 않습니다.</p>
        <p>등록된 사건 파일 및 진행 상황은 브라우저 메모리에만 일시적으로 유지되며, 페이지 새로고침 시 초기화될 수 있습니다. (JSON 내보내기/불러오기 기능을 이용해 저장 가능합니다.)</p>
        <div class="modal-close-row">
          <button onclick="closeModal()">확인</button>
        </div>
      </div>
    </div>
  `;
}

function closeModal(e) {
  if (!e || e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-x') || e.target.tagName === 'BUTTON') {
    document.getElementById('modalRoot').innerHTML = '';
  }
}

window.onload = function() {
  initDraftStages();
  loadDefaultRooms();
};
