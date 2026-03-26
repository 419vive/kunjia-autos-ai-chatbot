// ====================================================
// 崑家汽車 — 貸款利率評估表 Google Apps Script
// ====================================================
// 使用方法：
// 1. 打開 https://script.google.com
// 2. 點「新專案」
// 3. 把這整段 code 貼進去（取代原本的內容）
// 4. 點上方「執行」按鈕
// 5. 第一次會要求授權 → 允許
// 6. 執行完後，查看「執行記錄」裡的表單連結
// ====================================================

function createLoanForm() {
  var form = FormApp.create('💰 貸款利率評估表');
  form.setDescription(
    '填寫以下資料，我們會盡快為您評估最佳貸款方案\n\n' +
    '🔒 資料保密　✅ 免費評估　⚡ 快速回覆'
  );
  form.setConfirmationMessage(
    '✅ 已收到您的貸款諮詢！\n\n' +
    '我們的專業銷售人員會盡快與您聯繫，為您提供最適合的貸款方案。\n\n' +
    '📞 也可以直接撥打 0936-812-818 找賴先生\n' +
    '此表單僅供線上貸款評估使用，請您放心 ❤️'
  );

  // 1. 姓名（必填）
  form.addTextItem()
    .setTitle('您的姓名')
    .setRequired(true);

  // 2. 聯繫電話 / LINE（必填）
  form.addTextItem()
    .setTitle('聯繫電話 / LINE')
    .setHelpText('手機號碼或 LINE ID')
    .setRequired(true);

  // 3. 性別
  form.addMultipleChoiceItem()
    .setTitle('您的性別')
    .setChoiceValues(['男', '女']);

  // 4. 年紀
  form.addTextItem()
    .setTitle('您的年紀')
    .setHelpText('例如：28');

  // 5. 駕照
  form.addMultipleChoiceItem()
    .setTitle('是否有汽車駕照')
    .setChoiceValues(['有', '沒有']);

  // 6. 勞保薪轉
  form.addMultipleChoiceItem()
    .setTitle('目前的工作是否有勞工保險或是薪資轉帳')
    .setChoiceValues([
      '有勞保, 有薪轉',
      '有勞保, 領現金',
      '無勞保, 領現金'
    ]);

  // 7. 工作狀況
  form.addTextItem()
    .setTitle('請問您目前有工作嗎？工作多長時間了？')
    .setHelpText('例如：目前在XX公司，做了3年');

  // 8. 名下貸款（複選）
  form.addCheckboxItem()
    .setTitle('名下目前有沒有貸款？')
    .setChoiceValues(['房貸', '信貸', '車貸', '沒有']);

  // 9. 購車方式（必填）
  form.addMultipleChoiceItem()
    .setTitle('請問您要如何購車')
    .setChoiceValues([
      '現金購買',
      '有頭款其餘貸款',
      '全額貸',
      '超貸拿現金',
      '私分購車'
    ])
    .setRequired(true);

  // 10. 想詢問的車款
  form.addTextItem()
    .setTitle('想詢問的車款')
    .setHelpText('例如：Toyota Camry 2020年');

  // 11. 備註
  form.addParagraphTextItem()
    .setTitle('其他備註')
    .setHelpText('有什麼想補充的都可以寫在這裡...');

  // 加一段說明
  form.addSectionHeaderItem()
    .setTitle('📋 補充說明')
    .setHelpText(
      '✨ 確定車款才會做後續處理\n' +
      '🙋 信用瑕疵、信用小白也可以評估看看哦！有評估有機會\n' +
      '💪 除了銀行還有配合其他管道'
    );

  // 輸出結果
  var editUrl = form.getEditUrl();
  var publishedUrl = form.getPublishedUrl();
  var shortenedUrl = form.shortenFormUrl(publishedUrl);

  Logger.log('========================================');
  Logger.log('✅ 表單建立成功！');
  Logger.log('');
  Logger.log('📝 編輯連結（你自己用）：');
  Logger.log(editUrl);
  Logger.log('');
  Logger.log('🔗 填寫連結（給客人用）：');
  Logger.log(publishedUrl);
  Logger.log('');
  Logger.log('🔗 短連結：');
  Logger.log(shortenedUrl);
  Logger.log('========================================');
}
