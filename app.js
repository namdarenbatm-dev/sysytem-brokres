import { DEFAULTS, calculateBundles } from './engine.js';

const $ = (id) => document.getElementById(id);
const inputIds = Object.keys(DEFAULTS);
let currentResult = null;
let currentView = 'managementView';
let deferredInstallPrompt = null;
let hasPendingChanges = false;

const fa = (value, maxFraction = 2) => Number(value).toLocaleString('fa-IR', { maximumFractionDigits: maxFraction, minimumFractionDigits: 0 });
const money = (value) => `${fa(value)} میلیون تومان`;
const text = (id, value) => { $(id).textContent = value; };

function readInputs() {
  return Object.fromEntries(inputIds.map((id) => [id, $(id).value.trim() === '' ? '' : Number($(id).value)]));
}

function updateFieldPreviews() {
  const posBase = Number($('posBase').value);
  const marketing = Number($('posMarketing').value);
  const cost = Number($('cashCost').value);
  const markup = Number($('cashMarkup').value);
  const pre = posBase + marketing;
  text('preBundlePreview', Number.isFinite(pre) ? money(pre) : '—');
  if (cost > 0 && markup >= 0 && Number.isFinite(cost) && Number.isFinite(markup)) {
    text('markupPercent', `مارک‌آپ معادل ${fa((markup / cost) * 100, 2)}٪ بهای تمام‌شده کش‌لس است.`);
  } else {
    text('markupPercent', 'برای محاسبه درصد، بهای تمام‌شده باید بیشتر از صفر باشد.');
  }
}

function setBadge(kind, label) {
  const badge = $('modelBadge');
  badge.className = `status-pill ${kind}`;
  badge.querySelector('span:last-child').textContent = label;
}

function setMessage(message, kind = 'neutral') {
  const box = $('inputMessage');
  box.className = `message message-${kind}`;
  box.textContent = message;
}

function infoCell(label, value, extraClass = '') {
  return `<div class="info-cell ${extraClass}"><span>${label}</span><strong>${value}</strong></div>`;
}

function economicsRow(label, value, emphasis = false) {
  return `<div class="economics-row ${emphasis ? 'emphasis' : ''}"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderManagementBundles(result) {
  const host = $('managementBundles');
  host.innerHTML = '';
  $('managementMessage').hidden = result.bundles.length > 0;
  if (!result.bundles.length) {
    $('managementMessage').querySelector('strong').textContent = 'بسته‌ای تولید نشد';
    $('managementMessage').querySelector('p').textContent = result.errors.join(' ');
  }
  text('resultCount', `${fa(result.bundles.length, 0)} بسته`);

  for (let index = 0; index < result.bundles.length; index += 1) {
    const bundle = result.bundles[index];
    const article = document.createElement('article');
    article.className = 'bundle-card';
    article.innerHTML = `
      <div class="bundle-card-head">
        <div><h3>گزینه ${fa(index + 1, 0)} · ${fa(bundle.posCount, 0)} کارتخوان + ${fa(bundle.cashCount, 0)} کش‌لس</h3><p>با افزایش کش‌لس، قیمت کارتخوان تا کف بازار کاهش می‌یابد.</p></div>
        <span class="valid-tag">${bundle.valid ? 'قابل اجرا' : 'نامعتبر'}</span>
      </div>
      <div class="hero-price"><span class="label">قیمت تعدیل‌شده هر کارتخوان</span><strong>${money(bundle.adjustedPosPrice)}</strong><small>کف قیمت رقابتی: ${money(bundle.marketFloor)}</small></div>
      <div class="bundle-info-grid">
        ${infoCell('قیمت قبل از باندل کارتخوان', money(bundle.preBundlePrice))}
        ${infoCell('تخفیف موردنیاز هر کارتخوان', money(bundle.actualDiscountPerPos))}
        ${infoCell('تعداد کارتخوان', `${fa(bundle.posCount, 0)} دستگاه`)}
        ${infoCell('تعداد کش‌لس', `${fa(bundle.cashCount, 0)} عدد`)}
      </div>
      <div class="admin-economics">
        <h4>جزئیات اقتصادی مدیریت</h4>
        ${economicsRow('بودجه کل قابل‌استفاده باندل', money(bundle.totalCashBudget))}
        ${economicsRow('بودجه مصرف‌شده در باندل', money(bundle.bundleBudgetUsed))}
        ${economicsRow('بودجه باقی‌مانده باندل', money(bundle.remainingBudget), true)}
        ${economicsRow('قیمت واقعی کش‌لس در باندل', money(bundle.actualCashPriceInBundle), true)}
        ${economicsRow('ارزش اسمی کل بسته', money(bundle.nominalBundleTotal))}
      </div>
      ${bundle.capacityEnoughForFloor ? '<div class="bundle-warning">بودجه این ترکیب برای رسیدن به کف قیمت رقابتی کافی است؛ بودجه باقی‌مانده در قیمت واقعی کش‌لس در باندل منعکس شده است.</div>' : '<div class="bundle-warning">ظرفیت باندل بخشی از تخفیف را تأمین می‌کند؛ قیمت کارتخوان بالاتر از کف قیمت رقابتی باقی مانده است.</div>'}
    `;
    host.appendChild(article);
  }
}

function renderBrokerBundles(result) {
  const host = $('brokerBundles');
  host.innerHTML = '';
  $('brokerMessage').hidden = result.bundles.length > 0;
  $('brokerMessage').querySelector('strong').textContent = result.bundles.length ? '' : 'بسته‌ای برای نمایش وجود ندارد';
  $('brokerMessage').querySelector('p').textContent = result.bundles.length ? '' : result.errors.join(' ');
  $('brokerMessage').querySelector('[data-go-management]').hidden = result.bundles.length > 0;
  for (let index = 0; index < result.bundles.length; index += 1) {
    const bundle = result.bundles[index];
    const article = document.createElement('article');
    article.className = 'broker-card';
    article.innerHTML = `
      <div class="broker-card-head"><h3>بسته پیشنهادی ${fa(index + 1, 0)}</h3><span>${fa(bundle.cashCount, 0)} کش‌لس در بسته</span></div>
      <div class="broker-device-mix">
        <div class="device-tile"><span class="device-label">تعداد کارتخوان</span><strong>${fa(bundle.posCount, 0)}</strong><small>دستگاه</small></div>
        <div class="device-tile"><span class="device-label">تعداد کش‌لس</span><strong>${fa(bundle.cashCount, 0)}</strong><small>دستگاه</small></div>
      </div>
      <div class="broker-price"><span>قیمت خرید هر کارتخوان در این بسته</span><strong>${money(bundle.adjustedPosPrice)}</strong><small>قیمت رقابتی بازار: ${money(bundle.marketFloor)}</small></div>
      <div class="broker-summary">
        ${infoCell('جمع قیمت کارتخوان‌ها', money(bundle.adjustedPosPrice * bundle.posCount))}
        ${infoCell('قیمت فروش هر کش‌لس', money(bundle.cashSale))}
      </div>
      <div class="broker-total"><span>مبلغ کل بسته</span><strong>${money(bundle.brokerPackageTotal)}</strong></div>
    `;
    host.appendChild(article);
  }
  $('brokerFootnote');
}

function updateViewsAfterCalculation(result) {
  renderManagementBundles(result);
  renderBrokerBundles(result);
  const allValid = result.valid && result.bundles.length > 0;
  setBadge(allValid ? 'good' : 'bad', allValid ? `${fa(result.bundles.length, 0)} بسته معتبر` : 'نیازمند اصلاح ورودی');
  if (allValid) {
    const notice = result.notices?.join(' ');
    setMessage(notice || ` ${fa(result.bundles.length, 0)} بسته محاسبه شد. قیمت کارتخوان از کف قیمت رقابتی پایین‌تر نمی‌رود.`, notice ? 'neutral' : 'good');
  } else {
    setMessage(result.errors.join(' ') || 'بسته معتبری تولید نشد.', 'error');
  }
  hasPendingChanges = false;
  text('resultCount', `${fa(result.bundles.length, 0)} بسته`);
}

function generateBundles(event) {
  if (event) event.preventDefault();
  updateFieldPreviews();
  const raw = readInputs();
  const result = calculateBundles(raw);
  currentResult = result;
  updateViewsAfterCalculation(result);
}

function markPending() {
  updateFieldPreviews();
  hasPendingChanges = true;
  setBadge('neutral', 'ورودی تغییر کرده');
  setMessage('ورودی‌ها تغییر کرده‌اند؛ برای محاسبه نتایج جدید، «تولید بسته‌ها» را بزن.', 'neutral');
  $('managementBundles').innerHTML = '';
  $('brokerBundles').innerHTML = '';
  $('managementMessage').hidden = false;
  $('brokerMessage').hidden = false;
  $('managementMessage').querySelector('strong').textContent = 'نیاز به محاسبه مجدد';
  $('managementMessage').querySelector('p').textContent = 'برای جلوگیری از نمایش نتایج قدیمی، بسته‌ها پس از تغییر ورودی‌ها تا زمان محاسبه مجدد پنهان می‌شوند.';
  $('brokerMessage').querySelector('strong').textContent = 'بسته‌ها نیاز به به‌روزرسانی دارند';
  $('brokerMessage').querySelector('p').textContent = 'به نمای مدیریت برو و «تولید بسته‌ها» را انتخاب کن.';
  text('resultCount', '۰ بسته');
}

function selectView(viewId) {
  currentView = viewId;
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.view === viewId;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.view').forEach((view) => {
    const active = view.id === viewId;
    view.classList.toggle('active', active);
    view.hidden = !active;
  });
}

function downloadCsv() {
  if (!currentResult || hasPendingChanges || !currentResult.bundles.length) {
    showToast('ابتدا بسته‌ها را با ورودی‌های فعلی تولید کن.');
    return;
  }
  const rows = currentView === 'brokerView'
    ? [['بسته', 'تعداد کارتخوان', 'تعداد کش‌لس', 'قیمت هر کارتخوان', 'قیمت فروش هر کش‌لس', 'مبلغ کل بسته'], ...currentResult.bundles.map((b, i) => [`بسته ${i + 1}`, b.posCount, b.cashCount, b.adjustedPosPrice, b.cashSale, b.brokerPackageTotal])]
    : [['بسته', 'تعداد کارتخوان', 'تعداد کش‌لس', 'قیمت پایه کارتخوان', 'بودجه بازاریابی هر کارتخوان', 'قیمت قبل از باندل', 'قیمت رقابتی بازار', 'قیمت تعدیل‌شده کارتخوان', 'تخفیف هر کارتخوان', 'بودجه کل باندل', 'بودجه مصرف‌شده', 'بودجه باقی‌مانده', 'قیمت واقعی کش‌لس در باندل', 'ارزش اسمی بسته'], ...currentResult.bundles.map((b, i) => [`بسته ${i + 1}`, b.posCount, b.cashCount, Number($('posBase').value), Number($('posMarketing').value), b.preBundlePrice, b.marketFloor, b.adjustedPosPrice, b.actualDiscountPerPos, b.totalCashBudget, b.bundleBudgetUsed, b.remainingBudget, b.actualCashPriceInBundle, b.nominalBundleTotal])];
  const csv = '\ufeff' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = currentView === 'brokerView' ? 'بسته-های-قابل-ارائه-کارگزار.csv' : 'گزارش-مدیریتی-باندلینگ-ساده-ورژن-۴.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

let toastTimer;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function resetAll() {
  for (const [id, value] of Object.entries(DEFAULTS)) $(id).value = value;
  updateFieldPreviews();
  generateBundles();
  showToast('ورودی‌ها به مقادیر پیش‌فرض بازنشانی شدند.');
}

$('bundleForm').addEventListener('submit', generateBundles);
inputIds.forEach((id) => $(id).addEventListener('input', markPending));
document.querySelectorAll('[data-view]').forEach((tab) => tab.addEventListener('click', () => selectView(tab.dataset.view)));
document.querySelectorAll('[data-go-management]').forEach((button) => button.addEventListener('click', () => selectView('managementView')));
$('resetBtn').addEventListener('click', resetAll);
$('csvBtn').addEventListener('click', downloadCsv);
$('printBtn').addEventListener('click', () => window.print());
$('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').hidden = true;
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('installBtn').hidden = false;
});
window.addEventListener('appinstalled', () => showToast('برنامه نصب شد.'));

updateFieldPreviews();
generateBundles();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => showToast('ثبت Service Worker ناموفق بود؛ نصب آفلاین در دسترس نیست.')));
}
