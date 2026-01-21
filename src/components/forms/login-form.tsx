"use client";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { z } from "zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { loginSchema } from "@/lib/schemas/auth-schema";
import { useRouter } from "next/navigation";
import { LoginResponse } from "@/lib/types/api";


export default function LoginForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const handleSubmit: SubmitHandler<z.infer<typeof loginSchema>> = async (data) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });

    const { data: user, error } = (await response.json()) as LoginResponse;
    if (response.ok && user) {
      if (user.roleV4 === "super_admin" || user.roleV4 === "admin") {
        router.push("/dashboard");
      } else if (user.roleV4 === "warehouse_staff") {
        router.push("/assembly");
      } else {
        router.push("/orders");
      }

    } else {
      const error = (await response.json()) as LoginResponse;
      console.log("Login failed:", error);
      form.setError("root", { message: error?.error || "An unknown error occurred" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter your email or username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="Enter your password" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && <div className="text-red-500 text-sm">{form.formState.errors.root.message}</div>}

        <Button
          type="submit"
          className="w-full mt-4"
          disabled={form.formState.isSubmitting || !form.formState.isValid}
          loading={form.formState.isSubmitting}
        >
          Login
        </Button>
      </form>
    </Form>
  );
}
