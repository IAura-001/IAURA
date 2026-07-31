"use client";

import type { IAuraProject } from "@/types/project";
import { useI18n } from "@/core/i18n/I18nContext";

interface BrandingStudioProps {
  project: IAuraProject;
}

export default function BrandingStudio({
  project,
}: BrandingStudioProps) {
  const { t } = useI18n();

  return (
    <div className="mt-6 rounded-3xl border border-purple-500/30 bg-white/5 p-6 backdrop-blur-xl">
      <h2 className="mb-4 text-2xl font-bold">
        {t("branding.title")}
      </h2>

      <p className="text-white/60">
        {t("branding.project")}
      </p>

      <h3 className="mb-6 text-xl">
        {project.name}
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-white/50">
            {t("branding.name")}
          </p>

          <p className="font-semibold">
            {project.name.toUpperCase()}
          </p>
        </div>

        <div>
          <p className="text-white/50">
            {t("branding.slogan")}
          </p>
          <p>{t("branding.sloganValue")}</p>
        </div>

        <div>
          <p className="text-white/50">
            {t("branding.style")}
          </p>
          <p>{t("branding.styleValue")}</p>
        </div>

        <div>
          <p className="text-white/50">
            {t("branding.colors")}
          </p>
          <p>{t("branding.colorsValue")}</p>
        </div>
      </div>
    </div>
  );
}
