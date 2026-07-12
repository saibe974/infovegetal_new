<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ShadowModeRolloutAction: string
{
    case KeepShadowOnly = 'keep_shadow_only';
    case EnableLimitedRollout = 'enable_limited_rollout';
    case EnableGeneralRollout = 'enable_general_rollout';
    case BlockRollout = 'block_rollout';
}
