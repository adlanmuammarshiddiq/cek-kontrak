"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  LogOut,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface AnalysisResult {
  id: string;
  filename: string;
  total_klausul: number;
  klausul_aman: number;
  klausul_perlu_dicek: number;
  hasil: Array<{
    teks: string;
    flag: string;
    pasal_rujukan: string[];
    penjelasan: string;
  }>;
  disclaimer: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = api.getToken();
    const userData = api.getUser();
    if (!token) {
      router.push("/login");
    } else {
      setIsLoggedIn(true);
      setUser(userData);
    }
  }, [router]);

  const handleLogout = () => {
    api.auth.logout();
    router.push("/login");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setError("Hanya file PDF yang diizinkan");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File terlalu besar (max 10MB)");
        return;
      }
      setFile(selectedFile);
      setError("");
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setIsAnalyzing(true);
    setError("");

    try {
      const data = await api.contract.upload(file);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const amanPercentage = result
    ? Math.round((result.klausul_aman / result.total_klausul) * 100)
    : 0;

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Check Kontrak</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/graph">
              <Button variant="ghost" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Graph
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Selamat datang, {user?.name || "User"}
          </h1>
          <p className="text-muted-foreground">
            Upload kontrak kerja Anda untuk analisis terhadap PP 35/2021
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Kontrak
              </CardTitle>
              <CardDescription>
                Upload file PDF kontrak kerja Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  {file ? (
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">Klik untuk pilih file PDF</p>
                      <p className="text-sm text-muted-foreground">
                        atau drag and drop file di sini
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <Button
                className="w-full"
                onClick={handleUpload}
                disabled={!file || isUploading || isAnalyzing}
              >
                {isUploading || isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isUploading ? "Uploading..." : "Menganalisis..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Analisis Kontrak
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Hasil Analisis
              </CardTitle>
              <CardDescription>
                Ringkasan analisis kontrak Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Upload kontrak untuk melihat hasil</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Klausul Aman</span>
                      <span className="font-medium">{amanPercentage}%</span>
                    </div>
                    <Progress value={amanPercentage} className="h-3" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{result.total_klausul}</div>
                      <div className="text-xs text-muted-foreground">Total Klausul</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        {result.klausul_aman}
                      </div>
                      <div className="text-xs text-muted-foreground">Aman</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {result.klausul_perlu_dicek}
                      </div>
                      <div className="text-xs text-muted-foreground">Perlu Dicek</div>
                    </div>
                  </div>

                  {/* Flagged Clauses */}
                  {result.hasil.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Klausul Perlu Dicek:</h4>
                      {result.hasil.map((item, index) => (
                        <div
                          key={index}
                          className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-yellow-800 mb-1">
                                {item.pasal_rujukan.length > 0
                                  ? `Pasal: ${item.pasal_rujukan.join(", ")}`
                                  : "Tanpa rujukan spesifik"}
                              </p>
                              <p className="text-yellow-700">{item.penjelasan}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-600">
                    <strong>Disclaimer:</strong> {result.disclaimer}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setResult(null);
                      setFile(null);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Analisis Kontrak Lain
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
