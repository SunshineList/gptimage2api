"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuthKey } from "@/store/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    void getStoredAuthKey().then((key) => {
      if (key) {
        router.replace("/image");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return null;
}
