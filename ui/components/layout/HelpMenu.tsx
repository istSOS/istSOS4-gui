'use client'

import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@heroui/dropdown'
import { useTranslation } from 'react-i18next'

import { GithubIcon, HelpIcon, ReviewIcon } from '@/components/icons'

import { siteConfig } from '@/config/site'

export default function HelpMenu() {
  const { t } = useTranslation()
  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly
          variant="light"
          className="text-white"
          aria-label={t('navbar.helpAbout')}
          title={t('navbar.helpAbout')}
        >
          <HelpIcon size={22} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t('navbar.helpAbout')}
        variant="light"
        className="min-w-52"
      >
        <DropdownSection showDivider>
          <DropdownItem
            key="documentation"
            href={siteConfig.links.documentation}
            target="_blank"
            rel="noopener noreferrer"
            startContent={<ReviewIcon size={18} />}
          >
            {t('navbar.documentation')}
          </DropdownItem>
          <DropdownItem
            key="github"
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            startContent={<GithubIcon size={18} />}
          >
            {t('navbar.sourceCode')}
          </DropdownItem>
        </DropdownSection>
        <DropdownSection>
          <DropdownItem
            key="version"
            isReadOnly
            textValue={t('navbar.version', { version: siteConfig.version })}
            className="opacity-100"
          >
            <span className="block font-medium">istSOS4 GUI</span>
            <span className="block text-xs text-default-500">
              {t('navbar.version', { version: siteConfig.version })}
            </span>
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  )
}
