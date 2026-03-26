import { describe, it, expect } from 'vitest';
import { detectCustomerIntents, buildIntentInstructions, type CustomerIntent } from './vehicleDetectionService';

// ============ INTENT DETECTION TESTS ============

describe('detectCustomerIntents', () => {
  
  // ============ APPOINTMENT INTENT ============
  describe('appointment intent', () => {
    const appointmentMessages = [
      '可以明天約個看車時間嗎？',
      '我想平日上午去看車',
      '想到你們店裡看 ford 那台，明天下午什麼時候過去方便',
      '我想預約賞車',
      '禮拜六可以去看車嗎',
      '週末想去你們那看看',
      '明天下午去看可以嗎',
      '後天想過去看車',
      '什麼時候方便過去',
      '想去店裡看看',
      '我想去你們店看車',
      '平日晚上可以去看嗎',
      '我想試駕',
      '可以試乘嗎',
      '想預約試駕',
    ];
    
    appointmentMessages.forEach(msg => {
      it(`should detect appointment intent: "${msg}"`, () => {
        const intents = detectCustomerIntents(msg);
        expect(intents).toContain('appointment');
      });
    });
    
    it('should NOT detect appointment for general browsing', () => {
      const intents = detectCustomerIntents('有什麼車推薦嗎');
      expect(intents).not.toContain('appointment');
    });
  });
  
  // ============ ADDRESS INTENT ============
  describe('address intent', () => {
    const addressMessages = [
      '你們店地址在哪',
      '怎麼走到你們那',
      '店面在哪裡',
      '地址給我一下',
      '你們位置在哪',
      '怎麼去你們店',
      '可以導航嗎',
    ];
    
    addressMessages.forEach(msg => {
      it(`should detect address intent: "${msg}"`, () => {
        const intents = detectCustomerIntents(msg);
        expect(intents).toContain('address');
      });
    });
  });
  
  // ============ PHONE INTENT ============
  describe('phone intent', () => {
    const phoneMessages = [
      '電話多少',
      '你們手機號碼是什麼',
      '怎麼聯繫你們',
      '聯絡方式是什麼',
      '可以打給你嗎',
    ];
    
    phoneMessages.forEach(msg => {
      it(`should detect phone intent: "${msg}"`, () => {
        const intents = detectCustomerIntents(msg);
        expect(intents).toContain('phone');
      });
    });
  });
  
  // ============ HOURS INTENT ============
  describe('hours intent', () => {
    const hoursMessages = [
      '營業時間是什麼時候',
      '你們幾點開',
      '開到幾點',
      '今天有開嗎',
      '禮拜天有營業嗎',
    ];
    
    hoursMessages.forEach(msg => {
      it(`should detect hours intent: "${msg}"`, () => {
        const intents = detectCustomerIntents(msg);
        expect(intents).toContain('hours');
      });
    });
  });
  
  // ============ LOAN INTENT ============
  describe('loan intent', () => {
    const loanMessages = [
      '可以貸款嗎',
      '利率多少',
      '可以分期嗎',
      '月付多少',
      '頭期要多少',
      '有零利率嗎',
    ];
    
    loanMessages.forEach(msg => {
      it(`should detect loan intent: "${msg}"`, () => {
        const intents = detectCustomerIntents(msg);
        expect(intents).toContain('loan');
      });
    });
  });
  
  // ============ MULTI-INTENT DETECTION ============
  describe('multi-intent detection', () => {
    it('should detect appointment + address', () => {
      const intents = detectCustomerIntents('想到你們店裡看 ford 那台，明天下午什麼時候過去方便，啊你們店地址在哪');
      expect(intents).toContain('appointment');
      expect(intents).toContain('address');
    });
    
    it('should detect appointment + phone', () => {
      const intents = detectCustomerIntents('我想預約看車，你們電話多少');
      expect(intents).toContain('appointment');
      expect(intents).toContain('phone');
    });
    
    it('should detect address + hours', () => {
      const intents = detectCustomerIntents('你們地址在哪，營業時間是什麼時候');
      expect(intents).toContain('address');
      expect(intents).toContain('hours');
    });
    
    it('should detect appointment + address + phone (triple intent)', () => {
      const intents = detectCustomerIntents('我想明天去看車，你們地址在哪，電話多少');
      expect(intents).toContain('appointment');
      expect(intents).toContain('address');
      expect(intents).toContain('phone');
    });
  });
  
  // ============ GREETING INTENT ============
  describe('greeting intent', () => {
    it('should detect greeting: "你好"', () => {
      const intents = detectCustomerIntents('你好');
      expect(intents).toContain('greeting');
    });
    
    it('should detect greeting: "請問"', () => {
      const intents = detectCustomerIntents('請問');
      expect(intents).toContain('greeting');
    });
    
    it('should NOT detect greeting in longer messages', () => {
      const intents = detectCustomerIntents('你好，我想看車');
      expect(intents).not.toContain('greeting');
    });
  });
  
  // ============ PROVIDING CONTACT INTENT ============
  describe('providing_contact intent', () => {
    const providingContactMessages = [
      '我的電話是0961014789',
      '我手機是0912345678',
      '電話是0912-345-678',
      '我的號碼是0961014789',
      '給你0961014789',
      '留個電話給你 0912345678',
      '我電話 0961014789',
    ];
    
    providingContactMessages.forEach(msg => {
      it(`should detect providing_contact intent: "${msg}"`, () => {
        const intents = detectCustomerIntents(msg);
        expect(intents).toContain('providing_contact');
        expect(intents).not.toContain('phone'); // Should NOT also trigger phone (asking for store phone)
      });
    });
    
    it('should NOT detect providing_contact when asking for store phone', () => {
      const intents = detectCustomerIntents('電話多少');
      expect(intents).not.toContain('providing_contact');
      expect(intents).toContain('phone');
    });
    
    it('should NOT detect providing_contact for random numbers in message', () => {
      const intents = detectCustomerIntents('這台車跑了30000公里');
      expect(intents).not.toContain('providing_contact');
    });
  });
  
  // ============ REAL FAILURE CASES ============
  describe('real failure cases from production', () => {
    it('Case 1: "可以明天約個看車時間嗎？" → must detect appointment', () => {
      const intents = detectCustomerIntents('可以明天約個看車時間嗎？');
      expect(intents).toContain('appointment');
    });
    
    it('Case 2: "我想平日上午去看車" → must detect appointment', () => {
      const intents = detectCustomerIntents('我想平日上午去看車');
      expect(intents).toContain('appointment');
    });
    
    it('Case 3: "想到你們店裡看ford那台，明天下午什麼時候過去方便，啊你們店地址在哪" → appointment + address', () => {
      const intents = detectCustomerIntents('想到你們店裡看ford那台，明天下午什麼時候過去方便，啊你們店地址在哪');
      expect(intents).toContain('appointment');
      expect(intents).toContain('address');
    });
    
    it('Case 4: "你們可以貸款嗎？利率多少？" → loan', () => {
      const intents = detectCustomerIntents('你們可以貸款嗎？利率多少？');
      expect(intents).toContain('loan');
    });
    
    it('Case 5: "我的電話是0961014789" → providing_contact (NOT phone)', () => {
      const intents = detectCustomerIntents('我的電話是0961014789');
      expect(intents).toContain('providing_contact');
      expect(intents).not.toContain('phone');
    });
  });
});

// ============ INSTRUCTION INJECTION TESTS ============

describe('buildIntentInstructions', () => {
  
  it('should return default guidance for no intents', () => {
    const result = buildIntentInstructions([], '你好', '人客');
    expect(result).toContain('沒有偵測到特定意圖');
  });
  
  it('should ask for phone directly for appointment "上午" (no time slots)', () => {
    const intents: CustomerIntent[] = ['appointment'];
    const result = buildIntentInstructions(intents, '我想平日上午去看車', '人客');
    // New logic: ask for phone directly, no time slots
    expect(result).toContain('預約看車指令');
    expect(result).toContain('方便留個電話');
    expect(result).toContain('我們業務');
    expect(result).toContain('絕對禁止');
  });
  
  it('should ask for phone directly for appointment "下午" (no time slots)', () => {
    const intents: CustomerIntent[] = ['appointment'];
    const result = buildIntentInstructions(intents, '明天下午想去看', '人客');
    expect(result).toContain('預約看車指令');
    expect(result).toContain('方便留個電話');
    expect(result).toContain('我們業務');
  });
  
  it('should ask for phone directly for appointment "晚上" (no time slots)', () => {
    const intents: CustomerIntent[] = ['appointment'];
    const result = buildIntentInstructions(intents, '晚上可以去看嗎', '人客');
    expect(result).toContain('預約看車指令');
    expect(result).toContain('方便留個電話');
    expect(result).toContain('我們業務');
  });
  
  it('should ask for phone directly when no specific time mentioned', () => {
    const intents: CustomerIntent[] = ['appointment'];
    const result = buildIntentInstructions(intents, '可以明天約個看車時間嗎', '人客');
    expect(result).toContain('預約看車指令');
    expect(result).toContain('方便留個電話');
    expect(result).toContain('我們業務');
    expect(result).toContain('絕對禁止');
  });
  
  it('should include address info for address intent', () => {
    const intents: CustomerIntent[] = ['address'];
    const result = buildIntentInstructions(intents, '你們地址在哪', '人客');
    expect(result).toContain('高雄市三民區大順二路269號');
    expect(result).toContain('肯德基斜對面');
    expect(result).toContain('maps.google.com');
  });
  
  it('should include phone for phone intent', () => {
    const intents: CustomerIntent[] = ['phone'];
    const result = buildIntentInstructions(intents, '電話多少', '人客');
    expect(result).toContain('0936-812-818');
    expect(result).toContain('賴先生');
  });
  
  it('should include hours for hours intent', () => {
    const intents: CustomerIntent[] = ['hours'];
    const result = buildIntentInstructions(intents, '營業時間', '人客');
    expect(result).toContain('9:00-20:00');
  });
  
  it('should collect contact info for loan intent instead of handoff', () => {
    const intents: CustomerIntent[] = ['loan'];
    const result = buildIntentInstructions(intents, '可以貸款嗎', '人客');
    expect(result).toContain('姓名：');
    expect(result).toContain('電話：');
    expect(result).toContain('方便通話時間：');
    expect(result).toContain('禁止轉真人');
  });
  
  it('should include multi-intent reminder when multiple intents', () => {
    const intents: CustomerIntent[] = ['appointment', 'address'];
    const result = buildIntentInstructions(intents, '想去看車，地址在哪', '人客');
    expect(result).toContain('2 個問題');
    expect(result).toContain('每個都回答');
  });
  
  it('should skip phone request if customer already has contact', () => {
    const intents: CustomerIntent[] = ['appointment'];
    const result = buildIntentInstructions(intents, '我想上午去看車', '人客', '0912-345-678');
    expect(result).toContain('已留電話');
    expect(result).not.toContain('方便留個電話嗎');
  });
  
  it('should ask for phone if customer has no contact', () => {
    const intents: CustomerIntent[] = ['appointment'];
    const result = buildIntentInstructions(intents, '我想上午去看車', '人客', null);
    expect(result).toContain('方便留個電話嗎');
  });
  
  // ============ REAL FAILURE CASE SIMULATION ============
  describe('real failure case: "我想平日上午去看車"', () => {
    it('should produce instructions asking for phone (not time slots)', () => {
      const intents = detectCustomerIntents('我想平日上午去看車');
      const result = buildIntentInstructions(intents, '我想平日上午去看車', '人客');
      
      // Must have appointment instructions
      expect(result).toContain('預約看車指令');
      // Must ask for phone directly
      expect(result).toContain('方便留個電話');
      expect(result).toContain('我們業務');
      // Must NOT recommend cars
      expect(result).toContain('絕對禁止');
    });
  });
  
  describe('real failure case: multi-question "ford + 明天下午 + 地址"', () => {
    it('should produce instructions for both appointment and address', () => {
      const msg = '想到你們店裡看ford那台，明天下午什麼時候過去方便，啊你們店地址在哪';
      const intents = detectCustomerIntents(msg);
      const result = buildIntentInstructions(intents, msg, '人客');
      
      // Must have appointment instructions asking for phone
      expect(result).toContain('預約看車指令');
      expect(result).toContain('方便留個電話');
      expect(result).toContain('我們業務');
      
      // Must have address
      expect(result).toContain('高雄市三民區大順二路269號');
      
      // Must have multi-intent reminder
      expect(result).toContain('個問題');
    });
  });
  
  // ============ PROVIDING CONTACT INSTRUCTION TESTS ============
  describe('real failure case: "我的電話是0961014789"', () => {
    it('should produce instructions to acknowledge phone, NOT recommend cars', () => {
      const intents = detectCustomerIntents('我的電話是0961014789');
      const result = buildIntentInstructions(intents, '我的電話是0961014789', '大哥');
      
      // Must have providing_contact instructions
      expect(result).toContain('留電話指令');
      expect(result).toContain('0961014789');
      expect(result).toContain('感謝');
      expect(result).toContain('我們業務');
      expect(result).toContain('絕對禁止');
    });
    
    it('should extract phone number correctly', () => {
      const intents = detectCustomerIntents('留個電話給你 0912-345-678');
      const result = buildIntentInstructions(intents, '留個電話給你 0912-345-678', '小姐');
      
      expect(result).toContain('0912-345-678');
      expect(result).toContain('小姐');
    });
  });
});
