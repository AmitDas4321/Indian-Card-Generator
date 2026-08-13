export interface CardData {
  photoUrl: string | null;
  name: string;
  idNumber: string;
  phoneNumber: string;
  address: string;
}

export interface FormErrors {
  photo?: string;
  name?: string;
  idNumber?: string;
  phoneNumber?: string;
  address?: string;
}
