const TWEET_ID_RE = /\/status\/(\d+)/;

export function tweetIdFromHref(href: string): string | null {
  const match = href.match(TWEET_ID_RE);
  return match?.[1] ?? null;
}

export function tweetIdFromArticle(article: Element): string | null {
  const links = article.querySelectorAll("a[href]");
  for (const link of links) {
    const id = tweetIdFromHref(link.getAttribute("href") ?? "");
    if (id) return id;
  }
  return null;
}

export function setArticleHidden(article: HTMLElement, hidden: boolean): void {
  article.style.display = hidden ? "none" : "";
}

export function findTweetArticles(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  const articles = root.querySelectorAll("article");
  for (const article of articles) {
    if (tweetIdFromArticle(article)) found.push(article as HTMLElement);
  }
  return found;
}

export function findNotificationRows(root: ParentNode): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const node of root.querySelectorAll('[data-testid="cellInnerDiv"]')) {
    if (
      tweetIdFromArticle(node) ||
      node.querySelector('a[href*="/status/"]') ||
      node.querySelector('a[href*="/i/user/"]')
    ) {
      rows.push(node as HTMLElement);
    }
  }
  return rows;
}
