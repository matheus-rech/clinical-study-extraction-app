import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Download, Eye, ArrowRight, Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/library");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg">PDF Data Extractor</span>
              <span className="text-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white px-2 py-0.5 rounded-full">
                AI Powered
              </span>
            </div>

            <div className="flex items-center gap-4">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isAuthenticated ? (
                <>
                  <span className="text-sm text-slate-600">
                    Welcome, {user?.name || "User"}
                  </span>
                  <Button onClick={() => navigate("/library")}>
                    Go to Library
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </>
              ) : (
                <Button onClick={handleGetStarted}>Sign In</Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Extract Clinical Trial Data with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              AI Precision
            </span>
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Upload your clinical trial PDFs and let AI agents automatically extract
            key data points with source linking. Review, verify, and export with
            confidence.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={handleGetStarted}>
              Get Started
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Sparkles className="h-6 w-6 text-purple-600" />}
            title="AI-Powered Extraction"
            description="Gemini AI automatically extracts study IDs, trial numbers, sample sizes, and outcomes with smart text grounding."
          />
          <FeatureCard
            icon={<Eye className="h-6 w-6 text-blue-600" />}
            title="Source Verification"
            description="Every extracted value links back to its source in the PDF. Click to highlight and verify the original text."
          />
          <FeatureCard
            icon={<Download className="h-6 w-6 text-emerald-600" />}
            title="W3C-Style Export"
            description="Export your annotations in standardized JSON format with page references for seamless integration."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <StepCard
              number={1}
              title="Upload PDF"
              description="Upload your clinical trial document to the secure library"
            />
            <StepCard
              number={2}
              title="Configure Schema"
              description="Define what data fields you want to extract (or use defaults)"
            />
            <StepCard
              number={3}
              title="Auto-Extract"
              description="AI agents extract data and link it to source locations"
            />
            <StepCard
              number={4}
              title="Review & Export"
              description="Verify extractions and export annotated results"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-slate-500">
          <p>PDF Data Extractor - Clinical Trial Document Analysis Platform</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-slate-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-600 text-sm">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}
