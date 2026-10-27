/**
 * Pure calculation engine for Simple Bundling v4.
 * All currency values are expressed in million toman.
 * Marketing budget affects only the pre-bundle POS price; it is never deducted from the Cashless bundle budget.
 */
export const DEFAULTS = Object.freeze({
  posBase: 19,
  posMarketing: 1,
  marketFloor: 15,
  cashCost: 25,
  cashSale: 42,
  cashMarkup: 2,
  posCount: 5,
  maxCashCount: 5,
});

const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export function validateInputs(input) {
  const errors = [];
  const numericFields = ["posBase", "posMarketing", "marketFloor", "cashCost", "cashSale", "cashMarkup", "posCount", "maxCashCount"];
  for (const key of numericFields) {
    const value = Number(input[key]);
    if (input[key] === "" || input[key] == null || !Number.isFinite(value)) {
      errors.push("همه ورودی‌ها باید عدد معتبر داشته باشند.");
      break;
    }
    if (value < 0) {
      errors.push("مبالغ نمی‌توانند منفی باشند.");
      break;
    }
  }
  if (Number.isInteger(Number(input.posCount)) === false || Number(input.posCount) < 1) {
    errors.push("تعداد کارتخوان در هر بسته باید عدد صحیح و حداقل ۱ باشد.");
  }
  if (Number.isInteger(Number(input.maxCashCount)) === false || Number(input.maxCashCount) < 1) {
    errors.push("حداکثر تعداد کش‌لس باید عدد صحیح و حداقل ۱ باشد.");
  }
  if (Number(input.posCount) > 500 || Number(input.maxCashCount) > 500) {
    errors.push("برای حفظ کارایی، تعداد هر ورودی حداکثر ۵۰۰ است.");
  }
  if (Number(input.cashCost) <= 0) {
    errors.push("بهای تمام‌شده کش‌لس باید بیشتر از صفر باشد تا درصد مارک‌آپ محاسبه شود.");
  }
  const preBundlePrice = Number(input.posBase) + Number(input.posMarketing);
  if (Number.isFinite(preBundlePrice) && Number(input.marketFloor) > preBundlePrice) {
    errors.push("قیمت رقابتی بازار از قیمت قبل از باندل بیشتر است؛ این دو ورودی را اصلاح کن.");
  }
  const cashBudgetPerUnit = Number(input.cashSale) - Number(input.cashCost) - Number(input.cashMarkup);
  if (Number.isFinite(cashBudgetPerUnit) && cashBudgetPerUnit < -0.0000001) {
    errors.push("قیمت فروش کش‌لس پس از کسر بهای تمام‌شده و مارک‌آپ، بودجه منفی ایجاد می‌کند.");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function calculateBundles(input) {
  const validation = validateInputs(input);
  if (!validation.valid) return { valid: false, errors: validation.errors, bundles: [], input: null };

  const posBase = Number(input.posBase);
  const posMarketing = Number(input.posMarketing);
  const marketFloor = Number(input.marketFloor);
  const cashCost = Number(input.cashCost);
  const cashSale = Number(input.cashSale);
  const cashMarkup = Number(input.cashMarkup);
  const posCount = Math.trunc(Number(input.posCount));
  const requestedMaxCashCount = Math.trunc(Number(input.maxCashCount));
  const maxCashCount = Math.min(requestedMaxCashCount, posCount);

  // Marketing budget is used only here: to form the POS pre-bundle price.
  const preBundlePrice = round4(posBase + posMarketing);
  // Marketing budget must not enter this formula.
  const cashBudgetPerUnit = round4(cashSale - cashCost - cashMarkup);
  const bundles = [];

  for (let cashCount = 1; cashCount <= maxCashCount; cashCount += 1) {
    const totalCashBudget = round4(cashBudgetPerUnit * cashCount);
    const discountNeededToReachFloorPerPos = round4(Math.max(0, preBundlePrice - marketFloor));
    const maxDiscountAvailablePerPos = round4(totalCashBudget / posCount);
    const adjustedPosPrice = round4(Math.max(marketFloor, preBundlePrice - maxDiscountAvailablePerPos));
    const actualDiscountPerPos = round4(preBundlePrice - adjustedPosPrice);
    const bundleBudgetUsed = round4(actualDiscountPerPos * posCount);
    let remainingBudget = round4(totalCashBudget - bundleBudgetUsed);
    if (Math.abs(remainingBudget) < 0.0001) remainingBudget = 0;
    const markupTotal = round4(cashMarkup * cashCount);
    const actualCashPriceInBundle = round4(cashCost + cashMarkup + remainingBudget / cashCount);
    const nominalBundleTotal = round4(adjustedPosPrice * posCount + cashSale * cashCount);
    const brokerPackageTotal = round4(adjustedPosPrice * posCount + cashSale * cashCount);
    const capacityEnoughForFloor = maxDiscountAvailablePerPos >= discountNeededToReachFloorPerPos;

    bundles.push({
      id: `bundle-${cashCount}`,
      posCount,
      cashCount,
      preBundlePrice,
      marketFloor,
      cashBudgetPerUnit,
      totalCashBudget,
      discountNeededToReachFloorPerPos,
      maxDiscountAvailablePerPos,
      adjustedPosPrice,
      actualDiscountPerPos,
      bundleBudgetUsed,
      remainingBudget,
      markupTotal,
      actualCashPriceInBundle,
      cashSale,
      cashCost,
      cashMarkup,
      nominalBundleTotal,
      brokerPackageTotal,
      capacityEnoughForFloor,
      valid: remainingBudget >= -0.0001 && actualCashPriceInBundle <= cashSale + 0.0001 && adjustedPosPrice >= marketFloor - 0.0001,
    });
  }

  const notices = [];
  if (requestedMaxCashCount > posCount) notices.push(`سقف کش‌لس به ${posCount} محدود شد؛ تعداد کش‌لس نمی‌تواند از تعداد کارتخوان بیشتر باشد.`);
  if (cashBudgetPerUnit === 0) notices.push("ظرفیت اقتصادی هر کش‌لس صفر است؛ با این ورودی‌ها کش‌لس بودجه‌ای برای کاهش قیمت کارتخوان ایجاد نمی‌کند.");

  return {
    valid: bundles.length > 0 && bundles.every((bundle) => bundle.valid),
    errors: bundles.length ? [] : ["با این ورودی‌ها بسته قابل تولیدی وجود ندارد."],
    bundles,
    input: {
      ...Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Number(value)])),
      preBundlePrice,
      cashBudgetPerUnit,
      maxCashCount,
      requestedMaxCashCount,
    },
    notices,
  };
}
