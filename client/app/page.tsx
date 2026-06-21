"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface DialogueLine {
  speaker: string;
  text: string;
}

const DIALOGUES: DialogueLine[] = [
  { speaker: "SYSTEM", text: "Cek Kontrak v1.0 loaded successfully..." },
  { speaker: "Koharu", text: "Selamat datang di Cek Kontrak!" },
  { speaker: "Koharu", text: "Saya Koharu, receptionis virtual." },
  { speaker: "Koharu", text: "Apakah Anda sedang mencari informasi tentang kontrak kerja?" },
  { speaker: "Koharu", text: "Silakan upload kontrak kerja Anda untuk analisis otomatis." },
  { speaker: "Koharu", text: "Semua data akan dicek dengan akurat sesuai PP 35/2021." },
  { speaker: "Koharu", text: "Silakan lakukan login atau sign up untuk mulai." },
];

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDialogue, setCurrentDialogue] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = api.getToken();
    setIsLoggedIn(!!token);
    setIsLoading(false);
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (isLoading) return;

    const dialogue = DIALOGUES[currentDialogue];
    if (!dialogue) {
      setShowChoices(true);
      return;
    }

    setIsTyping(true);
    setDisplayedText("");

    let charIndex = 0;
    const text = dialogue.text;

    typeIntervalRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
        }
        setIsTyping(false);

        // Show choices immediately after last dialogue
        if (currentDialogue === DIALOGUES.length - 1) {
          setShowChoices(true);
        }
      }
    }, 50);

    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
      }
    };
  }, [currentDialogue, isLoading]);

  const handleLogin = () => {
    router.push("/login");
  };

  const handleSignup = () => {
    router.push("/signup");
  };

  const advanceDialogue = () => {
    if (isTyping) {
      // Skip to end if typing
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
      }
      const dialogue = DIALOGUES[currentDialogue];
      if (dialogue) {
        setDisplayedText(dialogue.text);
      }
      setIsTyping(false);
    } else if (!showChoices && currentDialogue < DIALOGUES.length - 1) {
      setCurrentDialogue(currentDialogue + 1);
    }
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: "url(/background.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="text-white animate-pulse">Loading...</div>
      </div>
    );
  }

  const dialogue = DIALOGUES[currentDialogue];
  const isSystem = dialogue?.speaker === "SYSTEM";

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: "url(/background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Header */}
      <header className="relative z-50 border-b border-white/20">
        <div className="container mx-auto px-4 py-3">
          <span className="font-bold text-lg text-white">Cek Kontrak</span>
        </div>
      </header>

      {/* Click overlay for advancing dialogue - only when typing */}
      {!showChoices && isTyping && (
        <div
          className="fixed inset-0 z-30 cursor-pointer"
          onClick={advanceDialogue}
        />
      )}

      {/* Main Content */}
      <main className="relative z-20 flex flex-col items-center min-h-[calc(100vh-140px)] px-4 py-8 overflow-y-auto">
        {/* Character PNG - Static, no animation */}
        <div className="mb-8 flex-shrink-0">
          <Image
            src="/character.png"
            alt="Koharu"
            width={200}
            height={260}
            className="object-contain"
            priority
          />
        </div>

        {/* Dialogue Box - Centered */}
        <div className="w-full max-w-md flex-shrink-0">
          {/* Simple Dialogue Box */}
          <div className="bg-white rounded-lg shadow-lg p-6 relative">
            {/* Name */}
            {dialogue && !isSystem && (
              <p className="font-bold text-black mb-2">{dialogue.speaker}</p>
            )}

            {/* Text */}
            <p className="text-black leading-relaxed pr-12">
              {displayedText}
              {isTyping && <span className="animate-pulse">_</span>}
            </p>

            {/* System message */}
            {isSystem && (
              <p className="text-gray-500 font-mono text-sm">{displayedText}</p>
            )}

            {/* Next button inside dialogue - bottom right */}
            {!showChoices && !isTyping && (
              <button
                onClick={advanceDialogue}
                className="absolute bottom-3 right-3 text-xs text-gray-400 hover:text-gray-600 cursor-pointer z-40"
              >
                Next &gt;
              </button>
            )}
          </div>

          {/* Choices - Below dialogue, centered */}
          {showChoices && !isLoggedIn && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                onClick={handleLogin}
                className="w-48 bg-white hover:bg-gray-100 text-black font-bold py-3 border border-gray-300"
              >
                Login
              </Button>
              <Button
                onClick={handleSignup}
                className="w-48 bg-white hover:bg-gray-100 text-black font-bold py-3 border border-gray-300"
              >
                Sign Up
              </Button>
            </div>
          )}

          {showChoices && isLoggedIn && (
            <div className="mt-4 flex justify-center">
              <Link href="/dashboard">
                <Button className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-8 border border-gray-300">
                  Masuk ke Dashboard
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
