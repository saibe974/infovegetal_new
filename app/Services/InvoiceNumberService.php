<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceNumberService
{
    public const DEFAULT_PATTERN = '%annee%-%compteur%';

    public function validatePattern(string $pattern): void
    {
        $remaining = str_replace(['%date%', '%annee%', '%ref_client%', '%n°commande%', '%numero_commande%', '%compteur%'], '', $pattern);
        if (str_contains($remaining, '%') || preg_match('/[\x00-\x1F\/\\\\]/u', $pattern) || trim($pattern) === '') {
            throw ValidationException::withMessages(['pattern' => 'Variables inconnues ou caractères interdits dans le format.']);
        }
    }

    public function format(string $pattern, Cart $cart, int $counter): string
    {
        $this->validatePattern($pattern);
        $number = strtr($pattern, [
            '%date%' => now()->format('Ymd'), '%annee%' => now()->format('Y'),
            '%ref_client%' => (string) $cart->user->ref,
            '%n°commande%' => str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT),
            '%numero_commande%' => str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT),
            '%compteur%' => str_pad((string) $counter, 6, '0', STR_PAD_LEFT),
        ]);
        if (str_contains($pattern, '%ref_client%') && ! filled($cart->user->ref)) {
            throw ValidationException::withMessages(['pattern' => 'Renseignez la référence du client avant de numéroter sa facture.']);
        }
        if (mb_strlen($number) > 190 || preg_match('/[\x00-\x1F\/\\\\]/u', $number)) {
            throw ValidationException::withMessages(['pattern' => 'Le numéro obtenu est trop long ou contient des caractères interdits.']);
        }

        return $number;
    }

    // Called inside the invoice transaction: numbering and document issuance commit together.
    public function next(User $issuer, Cart $cart): string
    {
        DB::table('invoice_number_settings')->insertOrIgnore([
            'user_id' => $issuer->id, 'pattern' => self::DEFAULT_PATTERN,
            'next_number' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $settings = DB::table('invoice_number_settings')->where('user_id', $issuer->id)->lockForUpdate()->first();
        $number = $this->format($settings->pattern, $cart, $settings->next_number);
        if (DB::table('order_documents')->where('issuer_id', $issuer->id)->where('kind', 'invoice')->where('number', $number)->exists()) {
            throw ValidationException::withMessages(['pattern' => 'Ce format produit un numéro déjà utilisé. Ajoutez par exemple %compteur%.']);
        }
        DB::table('invoice_number_settings')->where('user_id', $issuer->id)->update([
            'next_number' => $settings->next_number + 1, 'updated_at' => now(),
        ]);

        return $number;
    }
}
