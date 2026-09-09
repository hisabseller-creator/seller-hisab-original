import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "About SellerHisab",
  description: "SellerHisab kya karta hai, kis seller ke liye hai aur Sales, Settlement, Bank Cash, Return/RTO aur profit ko simple way me kaise samjhata hai.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <InfoPage
    eyebrow="About SellerHisab"
    title="Online seller ka paisa aur profit simple way me samjho"
    intro="SellerHisab online sellers ko simple language me batata hai: kitni Sales hui, marketplace ne kitna Settlement diya, bank me actual kitna paisa aaya, Return/RTO me kahan loss hua aur akhir me kitna profit bacha."
    sections={[
      { title: "SellerHisab kya karta hai", paragraphs: ["Sales ko profit nahi maanta. SellerHisab Sales, Settlement, Bank Cash, product cost, Return/RTO, ads aur available expenses ko alag-alag dikhata hai, taaki seller ko clear rahe ki paisa kahan bana, kahan atka aur kahan loss hua."] },
      { title: "Kis seller ke liye hai", paragraphs: ["Ye Indian online sellers ke liye hai jo supported marketplaces aur channels ki reports se apna real money flow aur profit samajhna chahte hain. Meesho, Amazon India, Flipkart aur supported channels ka data jahan available ho, SellerHisab usko ek clear view me laata hai."] },
      { title: "Simple rule: jo data hai, wahi maana jayega", bullets: ["Order report batati hai kya becha gaya.", "Settlement report batati hai marketplace ne kitna payout dikhaya.", "Bank data batata hai actual kitna paisa bank me aaya.", "Important data missing ya unclear ho to SellerHisab guess nahi karta."] },
      { title: "Independence", paragraphs: ["SellerHisab is an independent seller analytics product. It is not affiliated with or endorsed by the marketplaces or commerce platforms it supports."] },
      { title: "Privacy approach", paragraphs: ["Normal report analysis is designed so raw marketplace files stay in the browser. Account features store only the normalized or account-level data described in the Privacy Policy. Marketplace passwords, OTPs and session cookies are never required."] },
    ]}
    note="Read the Methodology, Editorial Policy and Corrections Policy for how financial claims and public content are governed."
  />;
}
