import type { UserRecord } from "./types.ts";

export class UserCache {
  private readonly order: string[] = [];
  private readonly map = new Map<string, UserRecord>();

  constructor(private readonly limit: number) {}

  get(id: string): UserRecord | undefined {
    const user = this.map.get(id);
    if (user) this.touch(id);
    return user;
  }

  put(user: UserRecord): void {
    const prev = this.map.get(user.userId);
    const merged: UserRecord = {
      userId: user.userId,
      screenName: user.screenName ?? prev?.screenName ?? null,
      location: user.location ?? prev?.location ?? null,
      basedIn: user.basedIn ?? prev?.basedIn ?? null,
      connectedVia: user.connectedVia ?? prev?.connectedVia ?? null,
      lang: user.lang ?? prev?.lang ?? null,
    };
    this.map.set(user.userId, merged);
    this.touch(user.userId);
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

  private touch(id: string): void {
    const at = this.order.indexOf(id);
    if (at >= 0) this.order.splice(at, 1);
    this.order.push(id);
  }
}
