export interface MatchedUser {
  id: string;
  name: string;
  about: string;
  avatarUrl: string | null;
  phoneHash: string;
}

export interface DeviceContact {
  id: string;
  name: string;
  phoneNumber: string;
}
