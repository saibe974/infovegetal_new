<?php

namespace App\Services;

use Elibyy\TCPDF\Facades\TCPDF;

class CartTcpdfService
{
    public function download(array $payload, string $filename)
    {
        $html = view('pdf.cart_tcpdf', $payload)->render();

        TCPDF::SetCreator((string) config('app.name', 'Laravel'));
        TCPDF::SetAuthor((string) config('app.name', 'Laravel'));
        TCPDF::SetTitle('Panier de commande');
        TCPDF::SetSubject('Commande client');

        TCPDF::setPrintHeader(false);
        TCPDF::setPrintFooter(false);
        TCPDF::SetMargins(8, 8, 8);
        TCPDF::SetAutoPageBreak(true, 10);
        TCPDF::SetImageScale(1.25);
        TCPDF::SetFont('dejavusans', '', 9);
        TCPDF::AddPage('P', 'A4');
        TCPDF::writeHTML($html, true, false, true, false, '');

        return response()->streamDownload(function () {
            try {
                echo TCPDF::Output('', 'S');
            } finally {
                TCPDF::reset();
            }
        }, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
