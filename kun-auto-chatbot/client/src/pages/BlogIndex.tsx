import { blogPosts } from "@/data/blogPosts";
import { ChevronRight, BookOpen, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#303d4e] text-white">
        <div className="container py-6">
          <a href="/" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white/90 mb-3 transition-colors">
            ← 回到首頁
          </a>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-6 w-6 text-[#C4A265]" />
            <h1 className="text-2xl font-bold">二手車攻略｜崑家汽車購車指南</h1>
          </div>
          <p className="text-sm text-white/70 max-w-2xl">
            40年二手車專業知識，幫你避開買車地雷、規劃貸款、搞懂過戶手續。
            每篇文章都由崑家汽車資深顧問撰寫，內容實用、不賣弄術語。
          </p>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container py-2">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <a href="/" className="hover:text-foreground transition-colors">首頁</a>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">購車攻略</span>
          </nav>
        </div>
      </div>

      {/* Blog Grid */}
      <main className="container py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <a key={post.slug} href={`/blog/${post.slug}`} className="group block">
              <Card className="h-full transition-all hover:shadow-lg hover:-translate-y-0.5">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {post.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {post.publishedAt}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                    {post.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                    閱讀全文
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 rounded-2xl bg-[#303d4e] p-6 text-white text-center">
          <h2 className="text-lg font-bold mb-2">有買車問題？直接問我們</h2>
          <p className="text-sm text-white/70 mb-4">
            崑家汽車40年經驗，任何二手車相關問題都可以透過 LINE 免費諮詢
          </p>
          <a
            href="https://page.line.me/825oftez"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            加入 LINE 免費諮詢
          </a>
        </div>
      </main>
    </div>
  );
}
