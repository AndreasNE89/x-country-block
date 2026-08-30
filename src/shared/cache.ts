import type { UserRecord } from "./types.ts";

export class UserCache {
  private readonly order: string[] = [];
  private readonly map = new Map<string, UserRecord>();

  constructor(private readonly limit: number) {}

  get(id: string): UserRecord | undefined {
    return this.map.get(id);
  }

  put(user: UserRecord): void {
    const prev = this.map.get(user.userId);
    const merged: UserRecord = {
      userId: user.userId,
      location: user.location ?? prev?.location ?? null,
      basedIn: user.basedIn ?? prev?.basedIn ?? null,
      lang: user.lang ?? prev?.lang ?? null,
    };
    this.map.set(user.userId, merged);
    const at = this.order.indexOf(user.userId);
    if (at >= 0) this.order.splice(at, 1);
    this.order.push(user.userId);
    while (this.order.length > this.limit) {
      const evict = this.order.shift();
      if (evict) this.map.delete(evict);
    }
  }

  dump(): UserRecord[] {
    return this.order.map((id) => this.map.get(id)).filter((row): row is UserRecord => !!row);
  }

  load(users: UserRecord[]): void {
    for (const user of users) this.put(user);
  }
}
