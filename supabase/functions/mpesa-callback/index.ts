import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MpesaCallbackItem {
  Name?: string;
  Value?: string | number;
}

interface MpesaCallbackMetadata {
  Item?: MpesaCallbackItem[];
}

interface MpesaStkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: MpesaCallbackMetadata;
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

    const body = await req.json();
    const stkCallback: MpesaStkCallback = body?.Body?.stkCallback;

    if (!stkCallback) {
      return new Response(JSON.stringify({ error: "Invalid callback format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    if (!checkoutRequestId) {
      return new Response(JSON.stringify({ error: "Missing CheckoutRequestID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the payment by provider_session_id
    const { data: payment, error: findError } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_session_id", checkoutRequestId)
      .maybeSingle();

    if (findError || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found for CheckoutRequestID: " + checkoutRequestId }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resultCode === 0) {
      // Payment successful — extract metadata
      const metadata = stkCallback.CallbackMetadata?.Item || [];
      const mpesaReceiptNo = metadata.find((m) => m.Name === "MpesaReceiptNumber")?.Value as string | undefined;
      const mpesaAmount = metadata.find((m) => m.Name === "Amount")?.Value as number | undefined;
      const mpesaPhone = metadata.find((m) => m.Name === "PhoneNumber")?.Value as string | undefined;

      await supabase
        .from("payments")
        .update({
          status: "successful",
          payer_details: {
            ...(payment.payer_details as Record<string, unknown> || {}),
            mpesa_receipt_no: mpesaReceiptNo,
            mpesa_amount: mpesaAmount,
            mpesa_phone: mpesaPhone,
            result_desc: resultDesc,
          },
        })
        .eq("id", payment.id);
    } else {
      // Payment failed or cancelled
      await supabase
        .from("payments")
        .update({
          status: "failed",
          payer_details: {
            ...(payment.payer_details as Record<string, unknown> || {}),
            result_desc: resultDesc,
            result_code: resultCode,
          },
        })
        .eq("id", payment.id);
    }

    return new Response(
      JSON.stringify({ received: true, resultCode, resultDesc }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
