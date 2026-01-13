/**
 * Reusable Statistics Card Component
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main value to display
 * @param {string} props.description - Description text
 * @param {React.Component} props.icon - Lucide icon component
 * @param {string} props.color - Color theme (blue, yellow, green, red, purple)
 */
function StatCard({ title, value, description, icon: Icon, color = 'blue' }) {
  
    const colorClasses = {
      blue: {
        border: 'border-blue-400 dark:border-blue-600',
        title: 'text-blue-900 dark:text-blue-200',
        icon: 'text-blue-600 dark:text-blue-400',
        value: 'text-blue-700 dark:text-blue-300'
      },
      yellow: {
        border: 'border-yellow-400 dark:border-yellow-600',
        title: 'text-yellow-900 dark:text-yellow-200',
        icon: 'text-yellow-600 dark:text-yellow-400',
        value: 'text-yellow-700 dark:text-yellow-300'
      },
      green: {
        border: 'border-emerald-400 dark:border-emerald-600',
        title: 'text-emerald-900 dark:text-emerald-200',
        icon: 'text-emerald-600 dark:text-emerald-400',
        value: 'text-emerald-700 dark:text-emerald-300'
      },
      red: {
        border: 'border-red-400 dark:border-red-600',
        title: 'text-red-900 dark:text-red-200',
        icon: 'text-red-600 dark:text-red-400',
        value: 'text-red-700 dark:text-red-300'
      },
      purple: {
        border: 'border-purple-400 dark:border-purple-600',
        title: 'text-purple-900 dark:text-purple-200',
        icon: 'text-purple-600 dark:text-purple-400',
        value: 'text-purple-700 dark:text-purple-300'
      }
    };
  
    const classes = colorClasses[color] || colorClasses.blue;
  
    return (
      <div className={`bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-6 border ${classes.border} transition-all duration-300 hover:shadow-2xl transform hover:scale-105`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${classes.title}`}>
            {title}
          </h3>
          {Icon && <Icon className={`w-8 h-8 ${classes.icon}`} />}
        </div>
        <p className={`text-4xl font-bold ${classes.value}`}>
          {value}
        </p>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {description}
          </p>
        )}
      </div>
    );
  }
  
  export default StatCard;