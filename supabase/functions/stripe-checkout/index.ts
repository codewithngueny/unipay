import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-12-18.acacia",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user's JWT and get their session
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = await userRes.json();

    const body = await req.json();
    const { studentId, invoiceId, paymentMethodId, amount, invoiceNumber, invoiceTitle, studentName } = body;

    if (!studentId || !amount || !paymentMethodId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a payment reference
    const { data: paymentRef } = await supabase.rpc("generate_payment_reference");
    if (!paymentRef) {
      return new Response(JSON.stringify({ error: "Failed to generate payment reference" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a pending payment record
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .insert({
        payment_reference: paymentRef,
        student_id: studentId,
        invoice_id: invoiceId || null,
        payment_method_id: paymentMethodId,
        amount: amount,
        status: "pending",
        provider: "stripe",
        payer_details: { student_name: studentName, user_email: user.email },
      })
      .select("*")
      .single();

    if (payError) {
      return new Response(JSON.stringify({ error: "Failed to create payment record: " + payError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: invoiceTitle || "University Fee Payment",
              description: invoiceNumber ? `Invoice: ${invoiceNumber}` : undefined,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/?payment=success&ref=${paymentRef}`,
      cancel_url: `${req.headers.get("origin")}/?payment=cancelled&ref=${paymentRef}`,
      metadata: {
        payment_id: payment.id,
        student_id: studentId,
        invoice_id: invoiceId || "",
        payment_ref: paymentRef,
      },
    });

    // Update payment with Stripe session ID
    await supabase
      .from("payments")
      .update({ provider_session_id: session.id })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({ url: session.url, paymentId: payment.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
