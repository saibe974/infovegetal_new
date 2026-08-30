<?php

namespace App\Mail;

use App\Models\PromotionMailing;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PromotionMailMessage extends Mailable
{
    public function __construct(
        public readonly PromotionMailing $mailing,
        public readonly string $unsubscribeUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->mailing->subject);
    }

    public function content(): Content
    {
        return new Content(view: 'mail.promotions.message', text: 'mail.promotions.message-text');
    }
}
