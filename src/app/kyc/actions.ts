"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { toE164 } from "@/lib/phone";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "pdf"]);

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return "bin";
}

// A document is a photo or a PDF of at most 8 MB. Checked here as well as in the browser.
function documentProblem(file: File): "size" | "type" | null {
  if (file.size > MAX_FILE_BYTES) return "size";
  const typeOk = /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.type);
  return typeOk && ALLOWED_EXT.has(extensionOf(file)) ? null : "type";
}

export async function submitKyc(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const t = await getTranslations("Actions");
  const tKyc = await getTranslations("Actions.kyc");
  const fail = (message: string, field?: string): never => redirect("/kyc?error=" + encodeURIComponent(message) + (field ? `&field=${field}` : ""));

  if (!(await checkRateLimit("kyc-submit", 5, 3600))) fail(t("rateLimit"));

  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  const nationalIdNumber = String(formData.get("nationalIdNumber") ?? "").trim();
  const idDocument = formData.get("idDocument") as File | null;
  const addressProof = formData.get("addressProof") as File | null;

  if (fullName.length < 2 || fullName.length > 80) fail(tKyc("fullNameInvalid"), "fullName");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} \-/]{3,39}$/u.test(nationalIdNumber)) fail(tKyc("idNumberInvalid"), "idNumber");

  // The phone number is asked here when the account does not have one yet.
  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).single();
  const typedPhone = String(formData.get("phoneNumber") ?? "").trim();
  if (!profile?.phone || typedPhone) {
    const phone = toE164(String(formData.get("phoneCountryCode") ?? ""), String(formData.get("phoneCountryIso") ?? ""), typedPhone);
    if (!phone) fail(tKyc("phoneInvalid"), "phone");
    const { error: phoneError } = await supabase.rpc("set_my_phone", { p_phone: phone });
    if (phoneError) fail(tKyc(phoneError.code === "CM073" ? "phoneTaken" : "phoneInvalid"), "phone");
  }

  if (!idDocument || idDocument.size === 0) fail(tKyc("idDocumentRequired"), "idDocument");
  const idProblem = documentProblem(idDocument!);
  if (idProblem) fail(tKyc(idProblem === "size" ? "fileTooLarge" : "fileTypeInvalid"), "idDocument");
  if (addressProof && addressProof.size > 0) {
    const proofProblem = documentProblem(addressProof);
    if (proofProblem) fail(tKyc(proofProblem === "size" ? "fileTooLarge" : "fileTypeInvalid"), "addressProof");
  }

  // One request at a time: a pending or approved request blocks a second one (a double press, or a second tab).
  const { data: existing } = await supabase
    .from("kyc_submissions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .limit(1);
  if (existing && existing.length > 0) redirect("/kyc");

  const idDocumentPath = `${user.id}/id-document-${Date.now()}.${extensionOf(idDocument!)}`;
  const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(idDocumentPath, idDocument!);
  if (uploadError) fail(tKyc("uploadFailed"));

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

  if (insertError) fail(tKyc("submitFailed"));

  redirect("/kyc");
}
