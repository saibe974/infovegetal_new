<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PromotionMailingUnsubscribeController extends Controller
{
    public function show(Request $request, User $user): View
    {
        return view('mail.promotions.unsubscribe', ['done' => ! $user->mailing, 'action' => $request->fullUrl()]);
    }

    public function unsubscribe(Request $request, User $user): View
    {
        $user->update(['mailing' => false]);

        return view('mail.promotions.unsubscribe', ['done' => true, 'action' => $request->fullUrl()]);
    }
}
