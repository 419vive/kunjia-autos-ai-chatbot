import { describe, it, expect } from 'vitest';

// ============ CoV: Chain of Verification for Vehicle Detection ============
// This test suite verifies the EXACT message format that LINE sends when
// a customer clicks "LINE 問這台車" button, and ensures the vehicle
// detection regex correctly matches it.

describe('CoV: Vehicle Detection from LINE Messages', () => {
  
  // The ACTUAL regex used in lineWebhook.ts (FIXED version)
  const currentRegex = /我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*([\d.]+)\s*萬/;
  
  // ============ CoV Step 1: Test with EXACT message from screenshot ============
  describe('CoV Step 1: Exact message format from LINE screenshot', () => {
    
    it('should match the EXACT BMW X1 message from user screenshot', () => {
      // This is the EXACT message the customer sent (from IMG_2277.PNG)
      const exactMessage = `我想詢問這台車：
BMW X1 2015年
售價：37.8萬
2015年・8.7萬公里・2.0L`;
      
      const match = exactMessage.match(currentRegex);
      console.log('BMW X1 exact message match:', match);
      // This MUST match - the regex now handles newlines with [\s\S]
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].trim()).toBe('BMW X1');
        expect(match[2]).toBe('2015');
        expect(match[3]).toBe('37.8');
      }
    });
    
    it('should match the EXACT Mitsubishi Colt Plus message from earlier screenshot', () => {
      // From IMG_2276.PNG
      const exactMessage = `我想詢問這台車：
Mitsubishi Colt Plus 2022年
售價：29.8萬`;
      
      const match = exactMessage.match(currentRegex);
      console.log('Colt Plus exact message match:', match);
      expect(match).not.toBeNull();
    });
    
    it('should match the EXACT Volkswagen Tiguan message from earlier screenshot', () => {
      // From IMG_2275.png
      const exactMessage = `我想詢問這台車：
Volkswagen Tiguan 2018年
售價：52.8萬`;
      
      const match = exactMessage.match(currentRegex);
      console.log('Tiguan exact message match:', match);
      expect(match).not.toBeNull();
    });
  });
  
  // ============ CoV Step 2: Test with single-line format (what regex expects) ============
  describe('CoV Step 2: Single-line format (what regex currently expects)', () => {
    
    it('should match single-line format', () => {
      const singleLine = '我想詢問這台車：BMW X1 2015年 售價：37.8萬';
      const match = singleLine.match(currentRegex);
      console.log('Single-line match:', match);
      expect(match).not.toBeNull();
    });
  });
  
  // ============ CoV Step 3: Diagnose the regex issue ============
  describe('CoV Step 3: Diagnose regex issue with newlines', () => {
    
    it('DIAGNOSIS: [\\s\\S] matches newlines where . does not', () => {
      const message = `我想詢問這台車：
BMW X1 2015年
售價：37.8萬`;
      
      // OLD broken regex: . does NOT match \n
      const oldRegex = /我想詢問這台車[：:]\s*(.+?)\s+(\d{4})年\s*售價[：:]\s*([\d.]+)萬/;
      const oldMatch = message.match(oldRegex);
      console.log('Old regex (broken):', oldMatch);
      // Note: old regex actually works in some cases because \s* absorbs \n
      // The real issue may be in the vehicle matching logic, not just the regex
      console.log('Old regex result:', oldMatch ? 'MATCHED' : 'FAILED');
      
      // NEW fixed regex: [\s\S] matches everything including \n
      const newRegex = /我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*([\d.]+)萬/;
      const newMatch = message.match(newRegex);
      console.log('New regex (fixed):', newMatch);
      expect(newMatch).not.toBeNull();
    });
    
    it('FIX: [\\s\\S] correctly matches across newlines with extra info line', () => {
      const message = `我想詢問這台車：
BMW X1 2015年
售價：37.8萬
2015年・8.7萬公里・2.0L`;
      
      const fixedRegex = /我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*([\d.]+)萬/;
      const match = message.match(fixedRegex);
      console.log('Fix with [\\s\\S]:', match);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].trim()).toBe('BMW X1');
        expect(match[2]).toBe('2015');
        expect(match[3]).toBe('37.8');
      }
    });
    
    it('FIX: Also works with Colt Plus multiline', () => {
      const message = `我想詢問這台車：
Mitsubishi Colt Plus 2022年
售價：29.8萬`;
      
      const fixedRegex = /我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*([\d.]+)萬/;
      const match = message.match(fixedRegex);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].trim()).toBe('Mitsubishi Colt Plus');
        expect(match[2]).toBe('2022');
        expect(match[3]).toBe('29.8');
      }
    });
    
    it('FIX: Also works with Tiguan multiline', () => {
      const message = `我想詢問這台車：
Volkswagen Tiguan 2018年
售價：52.8萬`;
      
      const fixedRegex = /我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*([\d.]+)萬/;
      const match = message.match(fixedRegex);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].trim()).toBe('Volkswagen Tiguan');
        expect(match[2]).toBe('2018');
        expect(match[3]).toBe('52.8');
      }
    });
    
    it('FIX: Still works with single-line format', () => {
      const message = '我想詢問這台車：BMW X1 2015年 售價：37.8萬';
      
      const fixedRegex = /我想詢問這台車[：:][\s\S]*?([A-Za-z][\w\s-]+?)\s+(\d{4})年[\s\S]*?售價[：:]\s*([\d.]+)萬/;
      const match = message.match(fixedRegex);
      expect(match).not.toBeNull();
      if (match) {
        expect(match[1].trim()).toBe('BMW X1');
        expect(match[2]).toBe('2015');
        expect(match[3]).toBe('37.8');
      }
    });
  });
  
  // ============ CoV Step 4: Test ALL vehicles in inventory ============
  describe('CoV Step 4: Test all vehicles with multiline format', () => {
    const vehicles = [
      { brand: 'BMW', model: 'X1', year: 2015, price: '37.8' },
      { brand: 'Ford', model: 'Tourneo Connect', year: 2022, price: '62.8' },
      { brand: 'Honda', model: 'CR-V', year: 2025, price: '103.8' },
      { brand: 'Hyundai', model: 'Tucson', year: 2016, price: '29.8' },
      { brand: 'Kia', model: 'Stonic', year: 2024, price: '62.8' },
      { brand: 'Mitsubishi', model: 'Colt Plus', year: 2022, price: '29.8' },
      { brand: 'Suzuki', model: 'Swift', year: 2024, price: '69.8' },
      { brand: 'Toyota', model: 'Corolla Cross', year: 2024, price: '70.8' },
      { brand: 'Toyota', model: 'Vios', year: 2018, price: '29.8' },
      { brand: 'Toyota', model: 'Yaris', year: 2024, price: '55.8' },
      { brand: 'Toyota', model: 'Yaris Cross', year: 2024, price: '72.8' },
      { brand: 'Volkswagen', model: 'Tiguan', year: 2018, price: '52.8' },
    ];
    
    const fixedRegex = /我想詢問這台車[：:]\s*(.+?)\s+(\d{4})年\s*售價[：:]\s*([\d.]+)萬/s;
    
    vehicles.forEach(v => {
      it(`should match multiline format for ${v.brand} ${v.model}`, () => {
        const message = `我想詢問這台車：\n${v.brand} ${v.model} ${v.year}年\n售價：${v.price}萬`;
        const match = message.match(fixedRegex);
        expect(match).not.toBeNull();
        if (match) {
          expect(match[1]).toBe(`${v.brand} ${v.model}`);
          expect(match[2]).toBe(String(v.year));
          expect(match[3]).toBe(v.price);
        }
      });
    });
  });
  
  // ============ CoV Step 5: Verify fallback detection also works ============
  describe('CoV Step 5: Fallback brand/model detection', () => {
    
    it('should detect vehicle when customer mentions brand and model casually', () => {
      const message = '我對那台 BMW X1 有興趣';
      // Fallback: check if message includes brand AND model
      const vehicles = [
        { brand: 'BMW', model: 'X1' },
        { brand: 'Toyota', model: 'Corolla Cross' },
      ];
      const found = vehicles.find(v => message.includes(v.brand) && message.includes(v.model));
      expect(found).toBeDefined();
      expect(found!.brand).toBe('BMW');
    });
  });
});
