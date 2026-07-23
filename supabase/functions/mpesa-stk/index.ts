import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MpesaTokenResponse {
  access_token?: string;
  expires_in?: string;
  error_description?: string;
}

interface StkPushResponse {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  errorMessage?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
    const { studentId, invoiceId, paymentMethodId, amount, phoneNumber, invoiceNumber, invoiceTitle, studentName } = body;

    if (!studentId || !amount || !paymentMethodId || !phoneNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // M-Pesa sandbox credentials
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE") || "174379";
    const passkey = Deno.env.get("MPESA_PASSKEY") || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    // Get OAuth token from M-Pesa sandbox
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: { Authorization: `Basic ${auth}` },
      },
    );
    const tokenData: MpesaTokenResponse = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ error: "Failed to get M-Pesa OAuth token" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate payment reference
    const { data: paymentRef } = await supabase.rpc("generate_payment_reference");

    // Create pending payment record
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .insert({
        payment_reference: paymentRef,
        student_id: studentId,
        invoice_id: invoiceId || null,
        payment_method_id: paymentMethodId,
        amount: amount,
        status: "pending",
        provider: "mpesa",
        payer_details: { phone: phoneNumber, student_name: studentName, user_email: user.email },
      })
      .select("*")
      .single();

    if (payError) {
      return new Response(JSON.stringify({ error: "Failed to create payment record: " + payError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build STK push password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Initiate STK push
    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.round(amount),
          PartyA: phoneNumber,
          PartyB: shortcode,
          PhoneNumber: phoneNumber,
          CallBackURL: callbackUrl,
          AccountReference: invoiceNumber || paymentRef,
          TransactionDesc: invoiceTitle || "University Fee Payment",
        }),
      },
    );
    const stkData: StkPushResponse = await stkRes.json();

    if (!stkData.CheckoutRequestID) {
      // Mark payment as failed
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return new Response(
        JSON.stringify({ error: stkData.errorMessage || stkData.ResponseDescription || "STK push failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update payment with M-Pesa checkout request ID
    await supabase
      .from("payments")
      .update({ provider_session_id: stkData.CheckoutRequestID })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        paymentId: payment.id,
        checkoutRequestId: stkData.CheckoutRequestID,
        message: stkData.CustomerMessage || "STK push sent. Check your phone to complete the payment.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
