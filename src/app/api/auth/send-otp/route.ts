import { NextResponse } from "next/server";
import { createClient } from "@/lib/clients/supabase-server";

const isE164 = (phone: string) => /^\+[1-9]\d{9,14}$/.test(phone);

export async function POST(req: Request) {
	const supabase = await createClient();
	const { phone } = await req.json();

	if (!phone) {
		return NextResponse.json(
			{ error: "Missing phone number" },
			{ status: 400 }
		);
	}
	if (!isE164(phone)) {
		return NextResponse.json(
			{ error: "Invalid phone number" },
			{ status: 400 }
		);
	}

	const { data, error } = await supabase.auth.signInWithOtp({
		phone,
		options: {
			channel: "whatsapp",
		},
	});

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({
		success: true,
		message: "OTP sent to phone",
		data,
	});
}
