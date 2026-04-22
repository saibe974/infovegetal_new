<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Lab404\Impersonate\Services\ImpersonateManager;

class ImpersonationController extends Controller
{
    public function __construct(private readonly ImpersonateManager $manager)
    {
    }

    public function take(Request $request, int $id, ?string $guardName = null): RedirectResponse
    {
        $guardName = $guardName ?? $this->manager->getDefaultSessionGuard();

        if ($this->manager->isImpersonating()) {
            abort(403, 'Already impersonating');
        }

        if ($id === (int) $request->user()->getAuthIdentifier() && $this->manager->getCurrentAuthGuardName() === $guardName) {
            abort(403, 'Cannot impersonate yourself');
        }

        /** @var User $target */
        $target = $this->manager->findUserById($id, $guardName);

        $this->authorize('impersonate', $target);

        if (!$target->canBeImpersonated()) {
            abort(403, 'Target cannot be impersonated');
        }

        if ($this->manager->take($request->user(), $target, $guardName)) {
            Log::info('users.impersonation.started', [
                'actor_id' => $request->user()->authorizationActor()->id,
                'effective_user_id' => $request->user()->id,
                'target_id' => $target->id,
            ]);

            $takeRedirect = $this->manager->getTakeRedirectTo();
            if ($takeRedirect !== 'back') {
                return redirect()->to($takeRedirect);
            }
        }

        return redirect()->back();
    }

    public function leave(Request $request): RedirectResponse
    {
        if (!$this->manager->isImpersonating()) {
            abort(403, 'Not impersonating');
        }

        $actor = $request->user()->authorizationActor();
        $effectiveUser = $request->user();

        $this->manager->leave();

        Log::info('users.impersonation.ended', [
            'actor_id' => $actor->id,
            'effective_user_id' => $effectiveUser->id,
        ]);

        $leaveRedirect = $this->manager->getLeaveRedirectTo();
        if ($leaveRedirect !== 'back') {
            return redirect()->to($leaveRedirect);
        }

        return redirect()->back();
    }
}
