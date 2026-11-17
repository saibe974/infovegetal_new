<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Lab404\Impersonate\Services\ImpersonateManager;

class ImpersonationController extends Controller
{
    private const STRICT_MODE_SESSION_KEY = 'impersonation.strict_mode';

    public function __construct(private readonly ImpersonateManager $manager)
    {
    }

    public function take(Request $request, int $id, ?string $guardName = null): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $guardName = $guardName ?? $this->manager->getDefaultSessionGuard();
        $switching = $this->manager->isImpersonating();

        // Pendant une impersonation, les droits sont TOUJOURS évalués sur
        // l'impersonateur réel (id stocké en session par le package), jamais
        // sur l'utilisateur impersoné, y compris en mode strict.
        /** @var User|null $actor */
        $actor = $switching ? $this->resolveRealImpersonator() : $request->user();

        if (! $actor) {
            abort(403, 'Impersonator not found');
        }

        if ($switching && $id === (int) $request->user()->getAuthIdentifier()) {
            // Déjà substitué à cet utilisateur : rien à faire.
            return redirect()->back();
        }

        if ($id === (int) $actor->getAuthIdentifier() && $this->manager->getCurrentAuthGuardName() === $guardName) {
            abort(403, 'Cannot impersonate yourself');
        }

        /** @var User $target */
        $target = $this->manager->findUserById($id, $guardName);

        Gate::forUser($actor)->authorize('impersonate', $target);

        if (!$target->canBeImpersonated()) {
            abort(403, 'Target cannot be impersonated');
        }

        $strictMode = false;
        if ($switching) {
            // Changement direct d'utilisateur : on conserve le mode choisi.
            $strictMode = (bool) $request->session()->get(self::STRICT_MODE_SESSION_KEY, false);

            // Retour sur le compte réel avant de reprendre une impersonation.
            // Si la suite échoue, l'utilisateur reste sur son propre compte.
            if (! $this->manager->leave()) {
                abort(403, 'Unable to switch impersonation');
            }
            $request->session()->forget(self::STRICT_MODE_SESSION_KEY);
        }

        if ($this->manager->take($actor, $target, $guardName)) {
            // Par defaut, on reste en mode gestion (droits admin conserves).
            $request->session()->put(self::STRICT_MODE_SESSION_KEY, $strictMode);

            if ($request->ajax()) {
                return response()->json(['csrf_token' => $request->session()->token()]);
            }

            // Log::info('users.impersonation.started', [
            //     'actor_id' => $request->user()->authorizationActor()->id,
            //     'effective_user_id' => $request->user()->id,
            //     'target_id' => $target->id,
            // ]);

            $takeRedirect = $this->manager->getTakeRedirectTo();
            if ($takeRedirect !== 'back') {
                return redirect()->to($takeRedirect);
            }
        }

        return redirect()->back();
    }

    public function leave(Request $request): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        if (!$this->manager->isImpersonating()) {
            abort(403, 'Not impersonating');
        }

        $actor = $request->user()->authorizationActor();
        $effectiveUser = $request->user();

        $this->manager->leave();
        $request->session()->forget(self::STRICT_MODE_SESSION_KEY);

        if ($request->ajax()) {
            return response()->json(['csrf_token' => $request->session()->token()]);
        }

        // Log::info('users.impersonation.ended', [
        //     'actor_id' => $actor->id,
        //     'effective_user_id' => $effectiveUser->id,
        // ]);

        $leaveRedirect = $this->manager->getLeaveRedirectTo();
        if ($leaveRedirect !== 'back') {
            return redirect()->to($leaveRedirect);
        }

        return redirect()->back();
    }

    private function resolveRealImpersonator(): ?User
    {
        try {
            $impersonator = $this->manager->getImpersonator();
        } catch (ModelNotFoundException) {
            return null;
        }

        return $impersonator instanceof User ? $impersonator : null;
    }

    public function setMode(Request $request): RedirectResponse
    {
        if (!$this->manager->isImpersonating()) {
            abort(403, 'Not impersonating');
        }

        $validated = $request->validate([
            'strict' => ['required', 'boolean'],
        ]);

        $strict = (bool) $validated['strict'];
        $request->session()->put(self::STRICT_MODE_SESSION_KEY, $strict);

        // Log::info('users.impersonation.mode.changed', [
        //     'actor_id' => $request->user()->authorizationActor()->id,
        //     'effective_user_id' => $request->user()->id,
        //     'strict' => $strict,
        // ]);

        return redirect()->back();
    }
}
