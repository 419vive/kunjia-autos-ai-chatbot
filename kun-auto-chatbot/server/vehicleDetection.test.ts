import { describe, it, expect } from 'vitest';
import {
  detectVehicleFromMessage,
  buildSmartVehicleKB,
  buildTargetVehiclePrompt,
  detectQuestionType,
  getQuestionAnswer,
  BRAND_ALIASES,
} from './vehicleDetectionService';

// ============ MOCK VEHICLES (based on real 8891 data) ============

const mockVehicles = [
  { id: 1, brand: 'BMW', model: 'X1', modelYear: '2019', price: '37.8', priceDisplay: '37.8萬', displacement: '2.0L', transmission: '自排', color: '白色', mileage: '5.2萬公里', fuelType: '汽油', bodyType: 'SUV', features: 'LED頭燈, 倒車雷達', description: 'BMW X1 sDrive20i 原廠保養' },
  { id: 2, brand: 'Toyota', model: 'Corolla Cross', modelYear: '2022', price: '72.8', priceDisplay: '72.8萬', displacement: '1.8L', transmission: '自排', color: '銀色', mileage: '2.1萬公里', fuelType: '汽油', bodyType: 'SUV', features: 'TSS安全系統', description: 'Corolla Cross 汽油版' },
  { id: 3, brand: 'Honda', model: 'CR-V', modelYear: '2020', price: '103.8', priceDisplay: '103.8萬', displacement: '1.5L', transmission: '自排', color: '黑色', mileage: '4.5萬公里', fuelType: '汽油', bodyType: 'SUV', features: 'Honda Sensing', description: 'Honda CR-V 1.5 VTi-S' },
  { id: 4, brand: 'Volkswagen', model: 'Tiguan', modelYear: '2021', price: '89.8', priceDisplay: '89.8萬', displacement: '1.4L', transmission: '自排', color: '灰色', mileage: '3.2萬公里', fuelType: '汽油', bodyType: 'SUV', features: 'ACC主動跟車', description: 'VW Tiguan 280 TSI' },
  { id: 5, brand: 'Kia', model: 'Stonic', modelYear: '2022', price: '52.8', priceDisplay: '52.8萬', displacement: '1.0L', transmission: '自排', color: '紅色', mileage: '1.8萬公里', fuelType: '汽油', bodyType: 'SUV', features: '全車影像', description: 'Kia Stonic 驚艷版' },
  { id: 6, brand: 'Ford', model: 'Tourneo Connect', modelYear: '2020', price: '62.8', priceDisplay: '62.8萬', displacement: '1.5L', transmission: '自排', color: '白色', mileage: '6.2萬公里', fuelType: '柴油', bodyType: 'MPV', features: '7人座', description: 'Ford Tourneo Connect 柴油版' },
];

// ============ TESTS ============

describe('vehicleDetectionService', () => {

  // ============ QUESTION TYPE DETECTION ============
  describe('detectQuestionType', () => {
    it('should detect displacement questions', () => {
      expect(detectQuestionType('BMW X1 的 cc 數是多少')).toBe('displacement');
      expect(detectQuestionType('排氣量多少')).toBe('displacement');
      expect(detectQuestionType('幾cc')).toBe('displacement');
      expect(detectQuestionType('引擎多大')).toBe('displacement');
    });

    it('should detect price questions', () => {
      expect(detectQuestionType('多少錢')).toBe('price');
      expect(detectQuestionType('價格多少')).toBe('price');
      expect(detectQuestionType('幾萬')).toBe('price');
    });

    it('should detect mileage questions', () => {
      expect(detectQuestionType('里程多少')).toBe('mileage');
      expect(detectQuestionType('跑多少公里')).toBe('mileage');
    });

    it('should detect transmission questions', () => {
      expect(detectQuestionType('是手排還是自排')).toBe('transmission');
    });

    it('should detect fuel questions', () => {
      expect(detectQuestionType('油耗好嗎')).toBe('fuel');
      expect(detectQuestionType('是柴油的嗎')).toBe('fuel');
    });

    it('should detect feature questions', () => {
      expect(detectQuestionType('有什麼配備')).toBe('features');
      expect(detectQuestionType('有倒車雷達嗎')).toBe('features');
    });

    it('should detect availability questions', () => {
      expect(detectQuestionType('還在嗎')).toBe('availability');
      expect(detectQuestionType('賣掉了嗎')).toBe('availability');
    });

    it('should return general for unrecognized questions', () => {
      expect(detectQuestionType('你好')).toBe('general');
      expect(detectQuestionType('我想看車')).toBe('general');
    });
  });

  // ============ QUESTION ANSWER MAPPING ============
  describe('getQuestionAnswer', () => {
    const vehicle = mockVehicles[0]; // BMW X1

    it('should return displacement answer', () => {
      expect(getQuestionAnswer(vehicle, 'displacement')).toBe('排氣量是 2.0L');
    });

    it('should return price answer', () => {
      expect(getQuestionAnswer(vehicle, 'price')).toBe('售價 37.8萬');
    });

    it('should return mileage answer', () => {
      expect(getQuestionAnswer(vehicle, 'mileage')).toBe('里程 5.2萬公里');
    });

    it('should return fallback for missing data', () => {
      const vehicleNoDisplacement = { ...vehicle, displacement: null };
      expect(getQuestionAnswer(vehicleNoDisplacement, 'displacement')).toBe('排氣量資料我幫你確認一下');
    });
  });

  // ============ VEHICLE DETECTION ============
  describe('detectVehicleFromMessage', () => {

    describe('THE CRITICAL BUG: "我要知道你們 BMW X1 的 cc 數"', () => {
      it('should detect BMW X1 and identify displacement question', () => {
        const result = detectVehicleFromMessage('我要知道你們 BMW X1 的 cc 數', mockVehicles);
        expect(result.type).toBe('mentioned');
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('BMW');
        expect(result.vehicle?.model).toBe('X1');
        expect(result.questionType).toBe('displacement');
        expect(result.directAnswer).toBe('排氣量是 2.0L');
      });
    });

    describe('Layer 1: "我想詢問這台車" button format', () => {
      it('should detect from button-format message with year and price', () => {
        const msg = '我想詢問這台車：BMW X1 2019年\n售價：37.8萬';
        const result = detectVehicleFromMessage(msg, mockVehicles);
        expect(result.type).toBe('inquiry_button');
        expect(result.vehicle?.brand).toBe('BMW');
        expect(result.vehicle?.model).toBe('X1');
      });

      it('should fallback when button format matches but vehicle not in DB', () => {
        const msg = '我想詢問這台車：Audi A4 2023年\n售價：120萬';
        const result = detectVehicleFromMessage(msg, mockVehicles);
        expect(result.type).toBe('inquiry_button');
        expect(result.vehicle).toBeNull();
      });
    });

    describe('Layer 2: Brand + Model mention (case-insensitive)', () => {
      const testCases = [
        { msg: 'BMW X1 多少錢', expectedBrand: 'BMW', expectedModel: 'X1' },
        { msg: '你們那台 X1 還在嗎', expectedBrand: 'BMW', expectedModel: 'X1' },
        { msg: 'Tiguan 的排氣量多少', expectedBrand: 'Volkswagen', expectedModel: 'Tiguan' },
        { msg: '我想看 CR-V', expectedBrand: 'Honda', expectedModel: 'CR-V' },
        { msg: 'Corolla Cross 有什麼配備', expectedBrand: 'Toyota', expectedModel: 'Corolla Cross' },
        { msg: 'Stonic 油耗好嗎', expectedBrand: 'Kia', expectedModel: 'Stonic' },
        { msg: '那台 Tourneo Connect 是柴油的嗎', expectedBrand: 'Ford', expectedModel: 'Tourneo Connect' },
      ];

      for (const tc of testCases) {
        it(`should detect "${tc.expectedBrand} ${tc.expectedModel}" from "${tc.msg}"`, () => {
          const result = detectVehicleFromMessage(tc.msg, mockVehicles);
          expect(result.vehicle).not.toBeNull();
          expect(result.vehicle?.brand).toBe(tc.expectedBrand);
          expect(result.vehicle?.model).toBe(tc.expectedModel);
        });
      }
    });

    describe('Case-insensitive matching', () => {
      it('should handle lowercase brand names', () => {
        const result = detectVehicleFromMessage('bmw x1 多少錢', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('BMW');
        expect(result.vehicle?.model).toBe('X1');
      });

      it('should handle mixed case', () => {
        const result = detectVehicleFromMessage('Bmw X1 的價格', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('BMW');
      });
    });

    describe('Chinese brand aliases', () => {
      it('should detect "寶馬" as BMW', () => {
        const result = detectVehicleFromMessage('你們的寶馬 X1 排氣量多少', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('BMW');
        expect(result.vehicle?.model).toBe('X1');
      });

      it('should detect "VW" as Volkswagen', () => {
        const result = detectVehicleFromMessage('VW Tiguan 多少錢', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('Volkswagen');
        expect(result.vehicle?.model).toBe('Tiguan');
      });

      it('should detect "福斯" as Volkswagen', () => {
        const result = detectVehicleFromMessage('福斯 Tiguan 的價格', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('Volkswagen');
      });

      it('should detect "豐田" as Toyota', () => {
        const result = detectVehicleFromMessage('豐田 Corolla Cross 多少', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('Toyota');
      });

      it('should detect "本田" as Honda', () => {
        const result = detectVehicleFromMessage('本田 CR-V 還在嗎', mockVehicles);
        expect(result.vehicle).not.toBeNull();
        expect(result.vehicle?.brand).toBe('Honda');
      });
    });

    describe('Edge cases', () => {
      it('should handle extra spaces', () => {
        const result = detectVehicleFromMessage('我要知道你們  BMW  X1  的  cc  數', mockVehicles);
        expect(result.vehicle).not.toBeNull();
      });

      it('should handle "cc數" without space', () => {
        const result = detectVehicleFromMessage('BMW X1的cc數', mockVehicles);
        expect(result.vehicle).not.toBeNull();
      });

      it('should handle "我想詢問這台車" fallback when no vehicle matched', () => {
        const result = detectVehicleFromMessage('我想詢問這台車', mockVehicles);
        expect(result.type).toBe('fallback');
      });

      it('should return none for unrelated messages', () => {
        const result = detectVehicleFromMessage('你好', mockVehicles);
        expect(result.type).toBe('none');
        expect(result.vehicle).toBeNull();
      });

      it('should return none for empty vehicle list', () => {
        const result = detectVehicleFromMessage('BMW X1 多少錢', []);
        expect(result.type).toBe('none');
        expect(result.vehicle).toBeNull();
      });
    });
  });

  // ============ SMART VEHICLE KB ============
  describe('buildSmartVehicleKB', () => {
    it('should show all vehicles with full details when no target', () => {
      const kb = buildSmartVehicleKB(mockVehicles, null);
      // Should contain all vehicle names
      expect(kb).toContain('BMW X1');
      expect(kb).toContain('Toyota Corolla Cross');
      expect(kb).toContain('Honda CR-V');
      // Should contain full details
      expect(kb).toContain('排氣量：2.0L');
      expect(kb).toContain('排氣量：1.8L');
    });

    it('should show target vehicle prominently when detected', () => {
      const kb = buildSmartVehicleKB(mockVehicles, mockVehicles[0]); // BMW X1
      // Target vehicle should have full details with star markers
      expect(kb).toContain('★★★ 客人詢問的車 ★★★');
      expect(kb).toContain('BMW X1');
      expect(kb).toContain('排氣量：2.0L');
      // Other vehicles should be abbreviated (one-liner)
      expect(kb).toContain('其他在售車輛（簡列）');
      expect(kb).toContain('Toyota Corolla Cross 2022年');
    });

    it('should return empty message for no vehicles', () => {
      const kb = buildSmartVehicleKB([], null);
      expect(kb).toContain('沒有在售車輛');
    });
  });

  // ============ TARGET VEHICLE PROMPT ============
  describe('buildTargetVehiclePrompt', () => {
    it('should return empty string when no vehicle detected', () => {
      const prompt = buildTargetVehiclePrompt(
        { type: 'none', vehicle: null, questionType: 'general', directAnswer: '' },
        '你好'
      );
      expect(prompt).toBe('');
    });

    it('should include direct answer for mentioned vehicle with specific question', () => {
      const detection = detectVehicleFromMessage('我要知道你們 BMW X1 的 cc 數', mockVehicles);
      const prompt = buildTargetVehiclePrompt(detection, '我要知道你們 BMW X1 的 cc 數');
      
      // Should be at the end (recency bias)
      expect(prompt).toContain('最後指令');
      expect(prompt).toContain('最高優先級');
      // Should include the direct answer
      expect(prompt).toContain('排氣量是 2.0L');
      // Should include the vehicle name
      expect(prompt).toContain('BMW X1');
      // Should prohibit recommending other vehicles
      expect(prompt).toContain('禁止推薦其他車款');
    });

    it('should include vehicle details for inquiry_button type', () => {
      const detection = detectVehicleFromMessage('我想詢問這台車：BMW X1 2019年\n售價：37.8萬', mockVehicles);
      const prompt = buildTargetVehiclePrompt(detection, '我想詢問這台車：BMW X1 2019年\n售價：37.8萬');
      
      expect(prompt).toContain('最後指令');
      expect(prompt).toContain('BMW X1');
      expect(prompt).toContain('37.8萬');
    });

    it('should include original message for fallback type', () => {
      const detection = detectVehicleFromMessage('我想詢問這台車', mockVehicles);
      const prompt = buildTargetVehiclePrompt(detection, '我想詢問這台車');
      
      expect(prompt).toContain('最後指令');
      expect(prompt).toContain('我想詢問這台車');
    });

    it('prompt should be placed at the END of system prompt (recency bias)', () => {
      // This is a structural test: the prompt should contain "最後指令" to indicate
      // it should be the last thing the LLM reads
      const detection = detectVehicleFromMessage('BMW X1 多少錢', mockVehicles);
      const prompt = buildTargetVehiclePrompt(detection, 'BMW X1 多少錢');
      expect(prompt).toContain('最後指令');
      expect(prompt).toContain('最高優先級');
    });
  });

  // ============ BRAND ALIASES ============
  describe('BRAND_ALIASES', () => {
    it('should have common Chinese brand names', () => {
      expect(BRAND_ALIASES['寶馬']).toBe('BMW');
      expect(BRAND_ALIASES['豐田']).toBe('Toyota');
      expect(BRAND_ALIASES['本田']).toBe('Honda');
      expect(BRAND_ALIASES['福斯']).toBe('Volkswagen');
      expect(BRAND_ALIASES['VW']).toBe('Volkswagen');
    });
  });
});
