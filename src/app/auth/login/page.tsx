"use client";

import LoginForm from "@/components/forms/login-form";
import { Button, buttonVariants } from "@/components/ui/button";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center md:px-0 px-4">
      <Card className="w-full max-w-md mb-4">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">Welcome Back</CardTitle>
          <CardDescription>Log in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            forgot password?
            <Link href="/auth/forgot-password" className={buttonVariants({ variant: "link", class: "px-2!" })}>
              Reset Password
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
