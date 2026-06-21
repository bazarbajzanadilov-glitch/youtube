import Card from '../../components/ui/Card.jsx'
import sx from './MonetizationExtras.module.css'

const revenueSources = [
  { title: 'Реклама на странице просмотра', tone: 'orange', icon: 'watch' },
  { title: 'Реклама в ленте Shorts', tone: 'yellow', icon: 'shorts' },
  { title: 'Спонсорство', tone: 'green', icon: 'sponsor' },
  { title: 'Подарки', tone: 'teal', icon: 'gift' },
  { title: 'Supers', tone: 'purple', icon: 'super' },
]

const creatorTools = [
  'Скачать медиакит',
  'Служба поддержки авторов YouTube',
  'Инструмент поиска совпадений',
  'Конечные заставки видео',
]

const resourceGroups = [
  {
    title: 'Поддержка',
    links: ['Справочный центр', 'Форумы сообщества'],
  },
  {
    title: 'Всё о программе',
    links: ['Канал YouTube Creators'],
  },
  {
    title: 'Важная информация',
    links: [
      'Правила монетизации',
      'Правила в отношении контента, подходящего для монетизации',
      'Другие способы монетизации',
    ],
  },
]

export default function MonetizationOverviewTab({ activeSection = 'Обзор', onOpenAdmin }) {
  return (
    <div className={sx.partnerPage} data-active-section={activeSection}>
      <main className={sx.partnerMain}>
        <section className={sx.partnerIntro}>
          <h2>Вы – партнер YouTube</h2>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ваши источники дохода</h3>
          <Card padding="none" depth="md" className={sx.sourceCard}>
            {revenueSources.map((source) => (
              <div className={sx.sourceRow} key={source.title}>
                <RevenueIcon icon={source.icon} tone={source.tone} />
                <span>{source.title}</span>
              </div>
            ))}
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Больше способов заработка</h3>
          <Card padding="none" depth="md" className={sx.accordionCard}>
            <div className={sx.expandPanel}>
              <div className={sx.panelCopy}>
                <div className={sx.panelTop}>
                  <h4>Покупки</h4>
                  <span aria-hidden="true">⌃</span>
                </div>
                <strong>Зрители могут стать покупателями</strong>
                <p>
                  Продвигайте на канале товары из своего магазина или других брендов в рамках партнерской программы YouTube Покупок.
                </p>
                <button type="button" className={sx.whiteButton}>Включить рекламу</button>
              </div>
              <div className={sx.shoppingArt} aria-hidden="true">
                <span />
              </div>
            </div>
            <button type="button" className={sx.foldRow}>
              <span>Коллаборации</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <Card padding="none" depth="md" className={sx.infoCard}>
            <div className={sx.infoPanel}>
              <div className={sx.panelCopy}>
                <div className={sx.panelTop}>
                  <h3>Основное о монетизации</h3>
                </div>
                <h4>Сведения о доходе</h4>
                <p>
                  Посмотреть расчетный доход можно в YouTube Аналитике, а итоговую сумму к оплате за месяц - в AdSense.
                </p>
                <div className={sx.buttonRow}>
                  <button type="button" className={sx.whiteButton}>Подробнее</button>
                  <button type="button" className={sx.darkButton}>Скрыть</button>
                </div>
              </div>
              <div className={sx.analyticsArt} aria-hidden="true">
                <span />
              </div>
            </div>
            <button type="button" className={sx.foldRow}>
              <span>Помощь</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ресурсы и инструменты для авторов</h3>
          <Card padding="lg" depth="md" className={sx.toolsCard}>
            {creatorTools.map((item) => (
              <button type="button" className={sx.toolLink} key={item}>
                <span className={sx.toolIcon} aria-hidden="true" />
                <span>{item}</span>
              </button>
            ))}
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ресурсы</h3>
          <Card padding="lg" depth="md" className={sx.resourcesCard}>
            {resourceGroups.map((group) => (
              <div className={sx.resourceGroup} key={group.title}>
                <h4>{group.title}</h4>
                {group.links.map((link) => (
                  <button type="button" key={link}>{link}</button>
                ))}
              </div>
            ))}
          </Card>
        </section>
      </main>

      <aside className={sx.partnerSide}>
        <Card padding="lg" depth="md" className={sx.sidePanel}>
          <h3>Настройка платежей</h3>
          <span className={sx.statusPill}>Выполняется</span>
          <div className={sx.sideBlock}>
            <h4>Что нужно сделать</h4>
            <strong>Пока действий от вас не требуется</strong>
            <p>
              Персональные данные подтверждены. Когда вы перейдете порог оплаты, мы сообщим о дальнейших действиях.
            </p>
          </div>
          <div className={sx.sideBlock}>
            <h4>Что дальше</h4>
            <p>Мы сообщим вам, когда нужно будет выбрать способ оплаты и завершить настройку.</p>
            <button type="button" className={sx.textLink}>Подробнее...</button>
          </div>
        </Card>

        <Card padding="lg" depth="md" className={sx.sidePanel}>
          <h3>Партнерская программа YouTube</h3>
          <div className={sx.sideBlock}>
            <h4>AdSense для YouTube</h4>
            <p>Идентификатор: pub-8534663269125491</p>
            <p>Связь установлена 3 мая 2026 г. в 03:17</p>
            <button type="button" className={sx.darkButton} onClick={onOpenAdmin}>Изменить</button>
          </div>
          <div className={sx.sideBlock}>
            <h4>Соглашения</h4>
            <p>
              Чтобы посмотреть принятые соглашения, в том числе условия Партнерской программы YouTube, нажмите кнопку ниже.
            </p>
            <button type="button" className={sx.darkButton}>Посмотреть соглашения</button>
          </div>
          <div className={sx.sideBlock}>
            <h4>Отказ от участия в Партнерской программе YouTube</h4>
            <p>В случае отказа вы лишитесь доступа к преимуществам программы. <button type="button" className={sx.inlineLink}>Подробнее</button></p>
            <button type="button" className={sx.darkButton}>Отказаться</button>
          </div>
        </Card>
      </aside>
    </div>
  )
}

function RevenueIcon({ icon, tone }) {
  return (
    <span className={`${sx.sourceIcon} ${sx[tone]}`} aria-hidden="true">
      {icon === 'watch' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M11.5 28.5 15.2 11l10.6-3.1 2.7 1.6-4.1 18.6-10 4.2-2.9-3.8Z" />
          <path d="m18.2 12.7 5.8-1.8-2.8 13.4-5.7 2.4 2.7-14Z" />
          <path d="M23.7 15.7h6.1l-2.9 12.7-6.1 2.4 2.9-15.1Z" />
        </svg>
      )}
      {icon === 'shorts' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M21.7 4 8 20.2h9.4L14.8 36 32 15.5h-9.8L24.9 4h-3.2Z" />
        </svg>
      )}
      {icon === 'sponsor' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="m20 5 4.4 9 9.9 1.4-7.2 7 1.7 9.8L20 27.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4L20 5Z" />
        </svg>
      )}
      {icon === 'gift' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M8 17h24v17H8V17Zm3-8.2c0-2.1 1.8-3.8 4-3.8 2.5 0 4.2 2.2 5 4.4.8-2.2 2.5-4.4 5-4.4 2.2 0 4 1.7 4 3.8 0 1.5-.8 2.8-2 3.5h6V17H7v-4.7h6c-1.2-.7-2-2-2-3.5Zm6.1 3.5c-.4-1.9-1.1-3.1-2.1-3.1-.7 0-1.3.5-1.3 1.2s.5 1.3 1.4 1.6l2 .3Zm5.8 0 2-.3c.9-.3 1.4-.9 1.4-1.6s-.6-1.2-1.3-1.2c-1 0-1.7 1.2-2.1 3.1ZM18 17h4v17h-4V17Z" />
        </svg>
      )}
      {icon === 'super' && (
        <svg viewBox="0 0 40 40" focusable="false">
          <path d="M20 7c6.2 0 11.3 4.2 11.3 9.5 0 3.2-1.9 6.1-4.8 7.8v6.2L20.4 26H20C13.8 26 8.7 21.8 8.7 16.5S13.8 7 20 7Zm-5.5 9.5c1.8 2.6 3.6 3.9 5.5 3.9s3.7-1.3 5.5-3.9h-4.2l-1.3 2-1.3-2h-4.2Z" />
        </svg>
      )}
    </span>
  )
}
