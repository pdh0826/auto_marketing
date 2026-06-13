export interface BloggerBlogProfile {
  id: string;
  name: string;
  url: string;
  bloggerBlogId: string;
}

export interface BloggerPostDraft {
  title: string;
  html: string;
  labels?: string[];
}
