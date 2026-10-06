export type Role = 'General User' | 'Admin';
export interface User { id: string; name: string; email: string; role: Role; active: boolean; joined: string }
export interface CheckRecord { id: string; ownerId: string; subject: string; type: string; status: string; updated: string; reference: string }
