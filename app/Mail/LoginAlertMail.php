<?php

namespace App\Mail;

use Carbon\CarbonInterface;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class LoginAlertMail extends Mailable
{
    public function __construct(
        public readonly array $loginUser,
        public readonly ?string $ipAddress,
        public readonly ?string $userAgent,
        public readonly CarbonInterface $loginAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: __('New login: :name', ['name' => (string) ($this->loginUser['name'] ?? '')]),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.auth.login-alert',
            text: 'mail.auth.login-alert-text',
        );
    }
}