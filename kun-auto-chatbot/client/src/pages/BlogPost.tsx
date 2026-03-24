import { useRoute } from "wouter";
import { getBlogPost, getRelatedPosts } from "@/data/blogPosts";
import { ChevronRight, Calendar, User, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import SeoFooter from "@/components/SeoFooter";

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const post = getBlogPost(slug);
  const related = getRelatedPosts(slug, 3);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h1 className="text-lg font-semibold mb-2">找不到這篇文章</h1>
          <p className="text-sm text-muted-foreground mb-4">文章可能已移除或連結有誤</p>
          <a href="/blog" className="text-sm text-primary hover:underline">← 回到購車攻略</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#303d4e] text-white">
        <div className="container py-6">
          <a href="/blog" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white/90 mb-3 transition-colors">
            ← 回到購車攻略
          </a>
          <Badge variant="outline" className="border-white/30 text-white/80 text-xs mb-3">
            {post.category}
          </Badge>
          <h1 className="text-xl sm:text-2xl font-bold leading-snug max-w-3xl">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> 發佈：{post.publishedAt}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> 更新：{post.updatedAt}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {post.author}
            </span>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container py-2">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <a href="/" className="hover:text-foreground transition-colors">首頁</a>
            <ChevronRight className="h-3 w-3" />
            <a href="/blog" className="hover:text-foreground transition-colors">購車攻略</a>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground truncate max-w-[150px] sm:max-w-[200px]">{post.title}</span>
          </nav>
        </div>
      </div>

      <div className="container py-8">
        <div className="md:grid md:grid-cols-[1fr_260px] md:gap-6 lg:grid-cols-[1fr_300px] lg:gap-10">
          {/* Main content */}
          <article>
            <p className="answer-summary text-sm text-muted-foreground leading-relaxed mb-6 p-4 bg-muted/40 rounded-lg border-l-4 border-primary" data-speakable>
              {post.description}
            </p>

            {/* Article body */}
            <div
              className="prose prose-sm sm:prose max-w-none
                prose-headings:font-bold prose-headings:text-foreground
                prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:pb-2
                prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
                prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
                prose-ul:my-3 prose-li:text-muted-foreground prose-li:my-1
                prose-strong:text-foreground
                prose-table:w-full prose-td:p-2 prose-th:p-2"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Author Bio — E-E-A-T signal for AI citation */}
            <div className="mt-8 pt-6 border-t">
              <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-[#303d4e] flex items-center justify-center text-white font-bold text-lg shrink-0">
                  賴
                </div>
                <div>
                  <p className="font-semibold text-sm" data-speakable>賴崑家｜崑家汽車創辦人</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed" data-speakable>
                    高雄在地超過40年二手車買賣經驗，專精車輛鑑定、貸款規劃與第三方認證制度。累計服務超過數千位車主，堅持實車實價、正派經營的理念。
                  </p>
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">相關關鍵字：</p>
              <div className="flex flex-wrap gap-2">
                {post.keywords.map(k => (
                  <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                ))}
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="mt-10 lg:mt-0 space-y-6">
            {/* CTA Box */}
            <div className="rounded-xl bg-[#303d4e] p-5 text-white sticky top-4">
              <h3 className="font-bold mb-1">有購車問題？</h3>
              <p className="text-xs text-white/70 mb-4 leading-relaxed">
                崑家汽車40年經驗，免費 LINE 諮詢，不強迫推銷
              </p>
              <a
                href="https://page.line.me/825oftez"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors w-full"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINE 免費諮詢
              </a>
              <a
                href="/"
                className="flex items-center justify-center gap-2 mt-2 rounded-lg border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors w-full"
              >
                瀏覽在售車輛
              </a>
              <a
                href="/faq"
                className="flex items-center justify-center gap-2 mt-2 rounded-lg border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors w-full"
              >
                常見問題 FAQ
              </a>
            </div>

            {/* Related posts */}
            {related.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">相關文章</h3>
                <div className="space-y-3">
                  {related.map(r => (
                    <a key={r.slug} href={`/blog/${r.slug}`} className="group block">
                      <Card className="transition-all hover:shadow-md">
                        <CardContent className="p-3">
                          <Badge variant="secondary" className="text-[10px] mb-1">{r.category}</Badge>
                          <p className="text-xs font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {r.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">{r.publishedAt}</p>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Price range links */}
            <div>
              <h3 className="text-sm font-semibold mb-3">依預算找車</h3>
              <div className="space-y-2">
                <a href="/price/under-30" className="block text-xs text-primary hover:underline">30萬以下二手車</a>
                <a href="/price/30-50" className="block text-xs text-primary hover:underline">30-50萬二手車</a>
                <a href="/price/50-80" className="block text-xs text-primary hover:underline">50-80萬二手車</a>
                <a href="/price/over-80" className="block text-xs text-primary hover:underline">80萬以上二手車</a>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <SeoFooter />
    </div>
  );
}
