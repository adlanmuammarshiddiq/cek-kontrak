"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await api.auth.login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundImage: "url(/background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Split Layout - Left: Character, Right: Form */}
      <div className="relative z-10 flex w-full">
        {/* Left Side - Character */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-8">
          <div className="animate-fade-in">
            <Image
              src="/character.png"
              alt="Koharu"
              width={300}
              height={400}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">

            {/* Form Card */}
            <div className="bg-white/95 rounded-lg shadow-lg p-6">
              <h1 className="text-xl font-bold text-center text-gray-800 mb-1">
                Login
              </h1>
              <p className="text-center text-gray-500 text-xs mb-4">
                Selamat datang kembali!
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-md">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs text-gray-600">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-8 text-sm border-gray-200 bg-white focus:border-pink-400 focus:ring-pink-100 text-black"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs text-gray-600">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-8 text-sm border-gray-200 bg-white focus:border-pink-400 focus:ring-pink-100 text-black"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-pink-400 hover:bg-pink-500 text-white font-bold py-2 text-sm rounded-md transition-colors mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  Belum punya akun?{" "}
                  <Link
                    href="/signup"
                    className="text-pink-500 hover:text-pink-600 font-medium"
                  >
                    Sign Up
                  </Link>
                </p>
              </div>

              <div className="mt-2 text-center">
                <Link
                  href="/"
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  &larr; Kembali ke Beranda
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
