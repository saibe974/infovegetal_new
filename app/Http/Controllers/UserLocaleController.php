<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserLocaleController extends Controller
{
    /**
     * Mettre à jour la préférence de langue de l'utilisateur
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'locale' => 'required|string|in:en,fr,es,de,it,nl',
        ]);

        /** @var User|null $user */
        $user = Auth::user();
        
        if ($user) {
            $user->locale = $validated['locale'];
            $user->save();

            // Mettre à jour la session
            session(['locale' => $validated['locale']]);
            app()->setLocale($validated['locale']);
        }

        return back();
    }
}
