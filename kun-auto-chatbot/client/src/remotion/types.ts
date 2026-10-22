/**
 * Shared types for Remotion compositions
 */
export interface VehicleVideoProps {
  title: string;
  brand: string;
  model: string;
  modelYear?: string;
  price: string;
  mileage?: string;
  transmission?: string;
  fuelType?: string;
  color?: string;
  displacement?: string;
  photoUrls: string[];
  dealerName?: string;
  dealerPhone?: string;
  dealerAddress?: string;
  lineUrl?: string;
  /** URL to background music audio file (mp3/wav). Optional — plays under the video */
  musicUrl?: string;
  /** 0–1 volume for background music. Default 0.3 */
  musicVolume?: number;
}

export const KUNJIA_BRAND = {
  name: "崑家汽車",
  founder: "賴崑家",
  phone: "0936-812-818",
  address: "高雄市三民區大順二路269號",
  hours: "週一至週日 9:30-20:00",
  lineUrl: "https://page.line.me/825oftez",
  gold: "#C4A265",
  darkBg: "#0a0a0a",
  white: "#ffffff",
};
