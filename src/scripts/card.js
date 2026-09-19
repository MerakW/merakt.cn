const clock = document.querySelector('#hangzhouClock');
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
function updateClock() {
  const now = new Date();
  clock.textContent = formatter.format(now);
  clock.dateTime = now.toISOString();
}
updateClock();
let ticker;
function syncClock() {
  clearInterval(ticker);
  if (!document.hidden) { updateClock(); ticker = setInterval(updateClock, 1000); }
}
syncClock();
document.addEventListener('visibilitychange', syncClock);
window.addEventListener('pagehide', () => clearInterval(ticker));
window.addEventListener('pageshow', syncClock);

const boardingStatus = document.querySelector('#boardingStatus');
const boardingStatusLabel = document.querySelector('#boardingStatusLabel');
const boardingStatusEnglish = document.querySelector('#boardingStatusEnglish');
const boardingStates = {
  waiting: { label: '等待登机', english: 'WAITING TO BOARD' },
  boarding: { label: '正在登机', english: 'NOW BOARDING' },
  'last-call': { label: '最后登机', english: 'LAST CALL' },
  closed: { label: '登机结束', english: 'BOARDING CLOSED' },
};
function updateBoardingStatus() {
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const state = minuteOfDay < 9 * 60 + 41 ? 'waiting'
    : minuteOfDay < 9 * 60 + 56 ? 'boarding'
      : minuteOfDay < 10 * 60 + 1 ? 'last-call'
        : 'closed';
  boardingStatus.dataset.state = state;
  boardingStatusLabel.textContent = boardingStates[state].label;
  boardingStatusEnglish.textContent = boardingStates[state].english;
}
updateBoardingStatus();
setInterval(updateBoardingStatus, 15_000);

const stampButton = document.querySelector('#collectStamp');
const storageKey = 'merak-boarding-souvenir-v1';
function showStamp(iso, persisted) {
  const date = new Date(iso);
  document.querySelector('#boardingStamp').hidden = false;
  const label = document.querySelector('#stampDate');
  label.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', day: '2-digit', month: 'short', year: 'numeric' }).format(date).toUpperCase();
  label.dateTime = date.toISOString();
  document.querySelector('#stampTitle').textContent = '已登机，星海见。';
  document.querySelector('#stampDescription').textContent = '这一程，留下了我们的相遇。';
  stampButton.disabled = true;
  stampButton.querySelector('span:last-child').textContent = '纪念章已领取';
  const note = document.querySelector('#stampNote');
  note.hidden = false;
  note.textContent = persisted ? '已留存在这台设备，期待下次相遇。' : '本次纪念章已盖好，期待下次相遇。';
}
try {
  const previous = localStorage.getItem(storageKey);
  if (previous && Number.isFinite(Date.parse(previous))) showStamp(previous, true);
} catch {}
stampButton.addEventListener('click', () => {
  const date = new Date().toISOString();
  let persisted = false;
  try { localStorage.setItem(storageKey, date); persisted = true; } catch {}
  showStamp(date, persisted);
});

const shareButton = document.querySelector('#shareCard');
if (navigator.share) {
  shareButton.hidden = false;
  shareButton.addEventListener('click', async () => {
    try {
      await navigator.share({ title: '米拉克 / Merak · 电子登机牌', text: '从杭州出发，在星海相遇。', url: 'https://merakt.cn/card' });
    } catch (error) {
      if (error.name === 'AbortError') return;
      const toast = document.querySelector('#toast');
      toast.textContent = '暂时无法分享，请使用浏览器的分享菜单。';
      toast.classList.add('is-visible');
      setTimeout(() => toast.classList.remove('is-visible'), 3000);
    }
  });
}
