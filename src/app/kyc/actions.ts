"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName;
  return "bin";
}

export async function submitKyc(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await checkRateLimit("kyc-submit", 5, 3600))) {
    redirect("/kyc?error=" + encodeURIComponent("محاولات كثيرة جدًا. يرجى الانتظار قليلًا قبل إعادة المحاولة."));
  }

  const fullName = formData.get("fullName") as string;
  const nationalIdNumber = formData.get("nationalIdNumber") as string;
  const idDocument = formData.get("idDocument") as File;
  const addressProof = formData.get("addressProof") as File | null;

  if (!idDocument || idDocument.size === 0) {
    redirect("/kyc?error=" + encodeURIComponent("صورة إثبات الهوية مطلوبة."));
  }

  const idDocumentPath = `${user.id}/id-document-${Date.now()}.${extensionOf(idDocument)}`;
  const { error: uploadError } = await supabase.storage
    .from("kyc-documents")
    .upload(idDocumentPath, idDocument);

  if (uploadError) {
    redirect("/kyc?error=" + encodeURIComponent("تعذّر رفع مستند إثبات الهوية. حاول مرة أخرى."));
  }

  let addressProofPath: string | null = null;
  if (addressProof && addressProof.size > 0) {
    addressProofPath = `${user.id}/address-proof-${Date.now()}.${extensionOf(addressProof)}`;
    await supabase.storage.from("kyc-documents").upload(addressProofPath, addressProof);
  }

  const { error: insertError } = await supabase.from("kyc_submissions").insert({
    user_id: user.id,
    full_name: fullName,
    national_id_number: nationalIdNumber,
    id_document_path: idDocumentPath,
    address_proof_path: addressProofPath,
  });

  if (insertError) {
    redirect("/kyc?error=" + encodeURIComponent("تعذّر إرسال طلب التوثيق. حاول مرة أخرى."));
  }

  redirect("/kyc");
}
